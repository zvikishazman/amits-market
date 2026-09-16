import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToGroupMembers } from "@/lib/push";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

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

  const questions = await prisma.question.findMany({
    where: { groupId },
    include: {
      options: {
        include: {
          bets: {
            select: { amount: true },
          },
        },
      },
      creator: {
        select: { id: true, name: true, image: true },
      },
      hiddenFrom: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter out questions hidden from the current user (unless they created it)
  const visibleQuestions = questions.filter((q) => {
    if (q.creatorId === session.user.id) return true;
    if (membership.role === "ADMIN") return true;
    return !q.hiddenFrom.some((u) => u.id === session.user.id);
  });

  const questionsWithTotals = visibleQuestions.map((q) => ({
    ...q,
    options: q.options.map((opt) => ({
      ...opt,
      totalBet: opt.bets.reduce((sum, b) => sum + b.amount, 0),
      betCount: opt.bets.length,
      bets: undefined,
    })),
    hiddenFromIds: q.hiddenFrom.map((u) => u.id),
    hiddenFrom: undefined,
  }));

  return NextResponse.json(questionsWithTotals);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { title, description, options, closesAt, betAmount, showBetChoices, hiddenFromUserIds } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Question title is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(options) || options.length < 2) {
    return NextResponse.json(
      { error: "At least 2 options are required" },
      { status: 400 }
    );
  }

  if (typeof betAmount !== "number" || betAmount < 1 || betAmount > 10000) {
    return NextResponse.json(
      { error: "Bet amount must be between 1 and 10,000" },
      { status: 400 }
    );
  }

  if (!closesAt) {
    return NextResponse.json(
      { error: "Betting deadline is required" },
      { status: 400 }
    );
  }

  const closeDate = new Date(closesAt);
  if (closeDate <= new Date()) {
    return NextResponse.json(
      { error: "Closing date must be in the future" },
      { status: 400 }
    );
  }

  const question = await prisma.question.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      groupId,
      creatorId: session.user.id,
      betAmount: Math.round(betAmount),
      closesAt: closeDate,
      showBetChoices: showBetChoices === true,
      options: {
        create: options.map((text: string) => ({ text: text.trim() })),
      },
      ...(Array.isArray(hiddenFromUserIds) && hiddenFromUserIds.length > 0
        ? { hiddenFrom: { connect: hiddenFromUserIds.map((id: string) => ({ id })) } }
        : {}),
    },
    include: {
      options: true,
    },
  });

  // Send push notifications to group members (non-blocking)
  // Exclude creator and any members the question is hidden from
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });
  if (group) {
    const excludeUserIds = [session.user.id, ...(Array.isArray(hiddenFromUserIds) ? hiddenFromUserIds : [])];
    sendPushToGroupMembers(groupId, excludeUserIds, {
      title: `${group.name}`,
      body: question.title,
      url: `/dashboard/groups/${groupId}/questions/${question.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ question }, { status: 201 });
}
