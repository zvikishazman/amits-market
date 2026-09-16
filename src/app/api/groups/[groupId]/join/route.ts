import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STARTING_BALANCE } from "@/lib/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { inviteCode } = body;

  if (!inviteCode) {
    return NextResponse.json(
      { error: "Invite code is required" },
      { status: 400 }
    );
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (group.inviteCode !== inviteCode) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 400 }
    );
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId,
      },
    },
  });

  if (existingMembership) {
    return NextResponse.json(
      { error: "You are already a member of this group" },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.create({
    data: {
      userId: session.user.id,
      groupId,
      balance: group.startingBalance ?? DEFAULT_STARTING_BALANCE,
    },
  });

  return NextResponse.json(membership, { status: 201 });
}
