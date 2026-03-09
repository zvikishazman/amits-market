import { NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { groupId: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = params;

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
    },
    orderBy: { createdAt: "desc" },
  });

  const questionsWithTotals = questions.map((q) => ({
    ...q,
    options: q.options.map((opt) => ({
      ...opt,
      totalBet: opt.bets.reduce((sum, b) => sum + b.amount, 0),
      betCount: opt.bets.length,
      bets: undefined,
    })),
  }));

  return NextResponse.json(questionsWithTotals);
}

export async function POST(
  request: Request,
  { params }: { params: { groupId: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = params;

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
  const { title, description, options, closesAt } = body;

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

  const question = await prisma.question.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      groupId,
      creatorId: session.user.id,
      closesAt: closesAt ? new Date(closesAt) : null,
      options: {
        create: options.map((text: string) => ({ text: text.trim() })),
      },
    },
    include: {
      options: true,
    },
  });

  return NextResponse.json({ question }, { status: 201 });
}
