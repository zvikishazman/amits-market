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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      creator: {
        select: { id: true, name: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      questions: {
        include: {
          creator: {
            select: { name: true },
          },
          options: {
            include: {
              _count: {
                select: { bets: true },
              },
              bets: {
                select: { amount: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      settlements: {
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Calculate per-member bet stats
  const allBets = await prisma.bet.findMany({
    where: {
      option: {
        question: { groupId },
      },
    },
    select: {
      userId: true,
      amount: true,
      payout: true,
    },
  });

  const memberStats: Record<string, { totalBet: number; totalWon: number; totalLost: number; betCount: number; winCount: number }> = {};
  for (const bet of allBets) {
    if (!memberStats[bet.userId]) {
      memberStats[bet.userId] = { totalBet: 0, totalWon: 0, totalLost: 0, betCount: 0, winCount: 0 };
    }
    const s = memberStats[bet.userId];
    s.betCount++;
    s.totalBet += bet.amount;
    if (bet.payout !== null) {
      if (bet.payout > 0) {
        s.totalWon += bet.payout - bet.amount;
        s.winCount++;
      } else {
        s.totalLost += bet.amount;
      }
    }
  }

  return NextResponse.json({ group, memberStats });
}
