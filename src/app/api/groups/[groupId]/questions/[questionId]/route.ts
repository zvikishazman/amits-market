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

  const isCreator = question.creatorId === session.user.id;
  const isAdmin = membership.role === "ADMIN";

  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: "Only the question creator or a group admin can modify this" },
      { status: 403 }
    );
  }

  const body = await request.json();

  // If resolvedOptionId is provided, resolve the question
  if (body.resolvedOptionId) {
    if (question.status !== "OPEN") {
      return NextResponse.json(
        { error: "Question is not open" },
        { status: 400 }
      );
    }

    const { resolvedOptionId } = body;
    const validOption = question.options.find((o) => o.id === resolvedOptionId);
    if (!validOption) {
      return NextResponse.json(
        { error: "Invalid option ID" },
        { status: 400 }
      );
    }

    const payouts = calculateResolutionPayouts(resolvedOptionId, question.options);

    const result = await prisma.$transaction(async (tx) => {
      for (const payout of payouts) {
        await tx.bet.update({
          where: { id: payout.betId },
          data: { payout: payout.payout },
        });
      }

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

  // Otherwise, edit the question (only if still OPEN)
  if (question.status !== "OPEN") {
    return NextResponse.json(
      { error: "Cannot edit a resolved question" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updateData.title = body.title.trim();
  }

  if (body.description !== undefined) {
    updateData.description = body.description?.trim() || null;
  }

  if (body.betAmount !== undefined) {
    const amt = Number(body.betAmount);
    if (isNaN(amt) || amt < 1 || amt > 10000) {
      return NextResponse.json({ error: "Bet amount must be between 1 and 10,000" }, { status: 400 });
    }
    // Only allow changing bet amount if no bets have been placed
    const hasBets = question.options.some((o) => o.bets.length > 0);
    if (hasBets) {
      return NextResponse.json({ error: "Cannot change bet amount after bets have been placed" }, { status: 400 });
    }
    updateData.betAmount = Math.round(amt);
  }

  if (body.closesAt !== undefined) {
    if (body.closesAt === null) {
      updateData.closesAt = null;
    } else {
      const closeDate = new Date(body.closesAt);
      if (closeDate <= new Date()) {
        return NextResponse.json({ error: "Closing date must be in the future" }, { status: 400 });
      }
      updateData.closesAt = closeDate;
    }
  }

  if (body.showBetChoices !== undefined) {
    updateData.showBetChoices = body.showBetChoices === true;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: updateData,
    include: {
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

  return NextResponse.json({ question: updated });
}
