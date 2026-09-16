import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
      userId_groupId: { userId: session.user.id, groupId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    include: {
      fromUser: { select: { id: true, name: true, image: true } },
      toUser: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ settlements });
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
      userId_groupId: { userId: session.user.id, groupId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { toUserId, amount } = body;

  if (!toUserId || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "toUserId and positive amount are required" },
      { status: 400 }
    );
  }

  if (toUserId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot settle with yourself" },
      { status: 400 }
    );
  }

  // Verify the target user is also a member
  const targetMembership = await prisma.membership.findUnique({
    where: {
      userId_groupId: { userId: toUserId, groupId },
    },
  });

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Target user is not a member" },
      { status: 400 }
    );
  }

  const settlement = await prisma.settlement.create({
    data: {
      groupId,
      fromUserId: session.user.id,
      toUserId,
      amount,
    },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ settlement }, { status: 201 });
}
