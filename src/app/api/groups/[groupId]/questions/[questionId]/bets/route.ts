import { NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/prisma";
import { calculateOdds } from "@/lib/odds";
import { MIN_BET, MAX_BET } from "@/lib/constants";

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

  const bets = await prisma.bet.findMany({
    where: {
      option: {
        questionId,
      },
    },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      option: {
        select: { id: true, text: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bets);
}

export async function POST(
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

  const body = await request.json();
  const { optionId, amount } = body;

  if (!optionId || typeof amount !== "number") {
    return NextResponse.json(
      { error: "optionId and amount are required" },
      { status: 400 }
    );
  }

  if (amount < MIN_BET || amount > MAX_BET) {
    return NextResponse.json(
      { error: `Bet amount must be between ${MIN_BET} and ${MAX_BET}` },
      { status: 400 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId, groupId },
    include: {
      options: {
        include: {
          bets: {
            select: { amount: true },
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
      { error: "Question is not open for betting" },
      { status: 400 }
    );
  }

  const validOption = question.options.find((o) => o.id === optionId);
  if (!validOption) {
    return NextResponse.json(
      { error: "Invalid option ID" },
      { status: 400 }
    );
  }

  if (membership.balance < amount) {
    return NextResponse.json(
      { error: "Insufficient balance" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Deduct balance from membership
    await tx.membership.update({
      where: {
        userId_groupId: {
          userId: session.user.id,
          groupId,
        },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    // Create the bet
    const bet = await tx.bet.create({
      data: {
        amount,
        userId: session.user.id,
        optionId,
      },
    });

    return bet;
  });

  // Recalculate odds after the bet
  const updatedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      options: {
        include: {
          bets: {
            select: { amount: true },
          },
        },
      },
    },
  });

  const odds = updatedQuestion ? calculateOdds(updatedQuestion.options) : null;

  return NextResponse.json({ bet: result, odds }, { status: 201 });
}
