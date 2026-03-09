import { NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/prisma";
import { calculateOdds, calculateResolutionPayouts } from "@/lib/odds";

export async function GET(
  request: Request,
  { params }: { params: { groupId: string; questionId: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, questionId } = params;

  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this group" },
      { status: 403 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId, groupId },
    include: {
      group: {
        select: { id: true, name: true },
      },
      creator: {
        select: { id: true, name: true, image: true },
      },
      options: {
        include: {
          bets: {
            include: {
              user: {
                select: { id: true, name: true, image: true },
              },
            },
          },
        },
      },
    },
  });

  if (!question) {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 }
    );
  }

  const odds = calculateOdds(question.options);

  return NextResponse.json({ question, odds });
}

export async function PATCH(
  request: Request,
  { params }: { params: { groupId: string; questionId: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, questionId } = params;

  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this group" },
      { status: 403 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId, groupId },
    include: {
      options: {
        include: {
          bets: {
            select: { id: true, amount: true, userId: true },
          },
        },
      },
    },
  });

  if (!question) {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 }
    );
  }

  if (question.status !== "OPEN") {
    return NextResponse.json(
      { error: "Question is not open" },
      { status: 400 }
    );
  }

  const isCreator = question.creatorId === session.user.id;
  const isAdmin = membership.role === "ADMIN";

  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: "Only the question creator or a group admin can resolve" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { resolvedOptionId } = body;

  if (!resolvedOptionId) {
    return NextResponse.json(
      { error: "resolvedOptionId is required" },
      { status: 400 }
    );
  }

  const validOption = question.options.find((o) => o.id === resolvedOptionId);
  if (!validOption) {
    return NextResponse.json(
      { error: "Invalid option ID" },
      { status: 400 }
    );
  }

  const payouts = calculateResolutionPayouts(resolvedOptionId, question.options);

  const result = await prisma.$transaction(async (tx) => {
    // Update all bets with their payout values
    for (const payout of payouts) {
      await tx.bet.update({
        where: { id: payout.betId },
        data: { payout: payout.payout },
      });
    }

    // Update membership balances for winners
    const payoutsByUser = payouts.reduce(
      (acc, p) => {
        if (p.payout > 0) {
          acc[p.userId] = (acc[p.userId] || 0) + p.payout;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    for (const [userId, totalPayout] of Object.entries(payoutsByUser)) {
      await tx.membership.update({
        where: {
          userId_groupId: {
            userId,
            groupId,
          },
        },
        data: {
          balance: { increment: totalPayout },
        },
      });
    }

    // Resolve the question
    const resolved = await tx.question.update({
      where: { id: questionId },
      data: {
        status: "RESOLVED",
        resolvedOptionId,
        resolvedAt: new Date(),
      },
      include: {
        options: {
          include: {
            bets: true,
          },
        },
      },
    });

    return resolved;
  });

  return NextResponse.json(result);
}
