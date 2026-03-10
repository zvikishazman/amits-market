import { NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/prisma";
import { calculateOdds } from "@/lib/odds";

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
  const { optionId } = body;

  if (!optionId) {
    return NextResponse.json(
      { error: "optionId is required" },
      { status: 400 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId, groupId },
    include: {
      options: {
        include: {
          bets: {
            select: { amount: true, userId: true },
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

  if (question.closesAt && new Date(question.closesAt) <= new Date()) {
    return NextResponse.json(
      { error: "Betting deadline has passed" },
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

  const amount = question.betAmount || 50;

  // Check if user already bet on this question
  const existingBet = question.options.some((opt) =>
    opt.bets.some((b) => b.userId === session.user.id)
  );
  if (existingBet) {
    return NextResponse.json(
      { error: "You already placed a bet on this question" },
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

    const bet = await tx.bet.create({
      data: {
        amount,
        userId: session.user.id,
        optionId,
      },
    });

    return bet;
  });

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

// Change bet (move to a different option)
export async function PUT(
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
  const { optionId } = body;

  if (!optionId) {
    return NextResponse.json(
      { error: "optionId is required" },
      { status: 400 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId, groupId },
    include: {
      options: {
        include: {
          bets: {
            select: { id: true, amount: true, userId: true, optionId: true },
          },
        },
      },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (question.status !== "OPEN") {
    return NextResponse.json({ error: "Question is not open" }, { status: 400 });
  }

  if (question.closesAt && new Date(question.closesAt) <= new Date()) {
    return NextResponse.json({ error: "Betting deadline has passed" }, { status: 400 });
  }

  const validOption = question.options.find((o) => o.id === optionId);
  if (!validOption) {
    return NextResponse.json({ error: "Invalid option ID" }, { status: 400 });
  }

  // Find user's existing bet
  let existingBet: { id: string; amount: number; userId: string; optionId: string } | null = null;
  for (const opt of question.options) {
    const found = opt.bets.find((b) => b.userId === session.user.id);
    if (found) {
      existingBet = found;
      break;
    }
  }

  if (!existingBet) {
    return NextResponse.json({ error: "You haven't placed a bet yet" }, { status: 400 });
  }

  if (existingBet.optionId === optionId) {
    return NextResponse.json({ error: "You already bet on this option" }, { status: 400 });
  }

  // Move bet to new option (same amount, just change optionId)
  await prisma.bet.update({
    where: { id: existingBet.id },
    data: { optionId },
  });

  const updatedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      options: {
        include: {
          bets: { select: { amount: true } },
        },
      },
    },
  });

  const odds = updatedQuestion ? calculateOdds(updatedQuestion.options) : null;

  return NextResponse.json({ success: true, odds });
}
