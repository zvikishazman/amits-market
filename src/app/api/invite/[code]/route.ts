import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { DEFAULT_STARTING_BALANCE } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: {
      creator: {
        select: { name: true },
      },
      _count: {
        select: { members: true },
      },
    },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    groupId: group.id,
    name: group.name,
    memberCount: group._count.members,
    creatorName: group.creator.name,
    startingBalance: group.startingBalance,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
  });

  if (!group) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  // Check if already a member
  const existing = await prisma.membership.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: group.id } },
  });

  if (existing) {
    return NextResponse.json({ groupId: group.id, message: "Already a member" });
  }

  await prisma.membership.create({
    data: {
      userId: session.user.id,
      groupId: group.id,
      role: "MEMBER",
      balance: group.startingBalance ?? DEFAULT_STARTING_BALANCE,
    },
  });

  return NextResponse.json({ groupId: group.id, message: "Joined successfully" });
}
