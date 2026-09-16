import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite";
import { DEFAULT_STARTING_BALANCE, MIN_STARTING_BALANCE, MAX_STARTING_BALANCE } from "@/lib/constants";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.group.findMany({
    where: {
      members: {
        some: { userId: session.user.id },
      },
    },
    include: {
      _count: {
        select: {
          members: true,
          questions: true,
        },
      },
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Flatten the role into the group object
  const groupsWithRole = groups.map((g) => ({
    ...g,
    myRole: g.members[0]?.role || "MEMBER",
    members: undefined,
  }));

  return NextResponse.json({ groups: groupsWithRole });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { name, startingBalance } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Group name is required" },
      { status: 400 }
    );
  }

  const balance = typeof startingBalance === "number"
    ? Math.min(MAX_STARTING_BALANCE, Math.max(MIN_STARTING_BALANCE, Math.round(startingBalance)))
    : DEFAULT_STARTING_BALANCE;

  const inviteCode = generateInviteCode();

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      inviteCode,
      startingBalance: balance,
      creatorId: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          role: "ADMIN",
          balance,
        },
      },
    },
    include: {
      _count: {
        select: {
          members: true,
          questions: true,
        },
      },
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
