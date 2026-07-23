import { NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/prisma";
import { calculateOdds, calculateResolutionPayouts, calculateDebts } from "@/lib/odds";

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
      hiddenFrom: {
        select: { id: true },
      },
    },
  });

  if (!question) {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 }
    );
  }

  // Block access for hidden users (unless creator or admin)
  const isHiddenFromMe = question.hiddenFrom.some((u) => u.id === session.user.id);
  if (isHiddenFromMe && question.creatorId !== session.user.id && membership.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 }
    );
  }

  const odds = calculateOdds(question.options);

  // Calculate debts if question is resolved
  let debts = null;
  if (question.status === "RESOLVED" && question.resolvedOptionId) {
    const betsForDebts = question.options.map((o) => ({
      id: o.id,
      bets: o.bets.map((b) => ({ userId: b.user.id, amount: b.amount })),
    }));
    debts = calculateDebts(question.resolvedOptionId, betsForDebts);
  }

  const hiddenFromIds = question.hiddenFrom.map((u) => u.id);
  const questionData = { ...question, hiddenFromIds, hiddenFrom: undefined };

  return NextResponse.json({ question: questionData, odds, debts });
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // If resolvedOptionId is provided, resolve the question
  if (body.resolvedOptionId) {
    if (question.status !== "OPEN") {
      return NextResponse.json(
        { error: "Question is not open" },
        { status: 400 }
      );
    }

    // Block resolution before deadline
    if (question.closesAt && new Date(question.closesAt) > new Date()) {
      return NextResponse.json(
        { error: "Cannot resolve before the betting deadline" },
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

    // Check if anyone bet on the winning option
    const winningOption = question.options.find((o) => o.id === resolvedOptionId);
    const winnerPool = winningOption ? winningOption.bets.reduce((s, b) => s + b.amount, 0) : 0;
    const noWinners = winnerPool === 0;

    const payouts = calculateResolutionPayouts(resolvedOptionId, question.options);

    const result = await prisma.$transaction(async (tx) => {
      if (noWinners) {
        // No one bet on the winning option — refund everyone their bets
        for (const opt of question.options) {
          for (const bet of opt.bets) {
            await tx.bet.update({
              where: { id: bet.id },
              data: { payout: bet.amount },
            });
            await tx.membership.update({
              where: {
                userId_groupId: {
                  userId: bet.userId,
                  groupId,
                },
              },
              data: {
                balance: { increment: bet.amount },
              },
            });
          }
        }
      } else {
        // Normal resolution — winners take the pool
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

  // Handle hiddenFrom updates
  let hiddenFromUpdate: { set: { id: string }[] } | null = null;
  if (body.hiddenFromUserIds !== undefined) {
    const ids = Array.isArray(body.hiddenFromUserIds) ? body.hiddenFromUserIds : [];
    hiddenFromUpdate = { set: ids.map((id: string) => ({ id })) };
  }

  // Validate options if provided
  let newOptions: { id?: string; text: string }[] | null = null;
  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.filter((o: { text: string }) => o.text?.trim()).length < 2) {
      return NextResponse.json({ error: "At least 2 options are required" }, { status: 400 });
    }
    newOptions = body.options.filter((o: { text: string }) => o.text?.trim());
  }

  if (Object.keys(updateData).length === 0 && !newOptions && !hiddenFromUpdate) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Refund all existing bets when editing the question
  const allBets = question.options.flatMap((o) => o.bets);

  const updated = await prisma.$transaction(async (tx) => {
    // Refund each bet
    for (const bet of allBets) {
      await tx.membership.update({
        where: {
          userId_groupId: {
            userId: bet.userId,
            groupId,
          },
        },
        data: {
          balance: { increment: bet.amount },
        },
      });
    }

    // Delete all bets for this question
    if (allBets.length > 0) {
      await tx.bet.deleteMany({
        where: {
          option: {
            questionId,
          },
        },
      });
    }

    // Handle option changes
    if (newOptions) {
      const existingIds = question.options.map((o) => o.id);
      const keptIds = newOptions.filter((o) => o.id).map((o) => o.id!);

      // Delete removed options
      const removedIds = existingIds.filter((id) => !keptIds.includes(id));
      if (removedIds.length > 0) {
        await tx.option.deleteMany({
          where: { id: { in: removedIds }, questionId },
        });
      }

      // Update existing options
      for (const opt of newOptions) {
        if (opt.id && existingIds.includes(opt.id)) {
          await tx.option.update({
            where: { id: opt.id },
            data: { text: opt.text.trim() },
          });
        }
      }

      // Create new options
      const newOpts = newOptions.filter((o) => !o.id);
      if (newOpts.length > 0) {
        await tx.option.createMany({
          data: newOpts.map((o) => ({ text: o.text.trim(), questionId })),
        });
      }
    }

    // Update the question
    return tx.question.update({
      where: { id: questionId },
      data: {
        ...updateData,
        ...(hiddenFromUpdate ? { hiddenFrom: hiddenFromUpdate } : {}),
      },
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
  });

  return NextResponse.json({ question: updated, refundedBets: allBets.length });
}
