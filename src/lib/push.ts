import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(
    "mailto:noreply@amits-market.vercel.app",
    publicKey,
    privateKey
  );
  vapidConfigured = true;
}

export async function sendPushToGroupMembers(
  groupId: string,
  excludeUserIds: string | string[],
  payload: { title: string; body: string; url: string }
) {
  ensureVapid();
  if (!vapidConfigured) return;

  const excludeIds = Array.isArray(excludeUserIds) ? excludeUserIds : [excludeUserIds];

  // Get all group members' push subscriptions (except excluded users)
  const memberships = await prisma.membership.findMany({
    where: { groupId, userId: { notIn: excludeIds } },
    select: { userId: true },
  });

  const userIds = memberships.map((m) => m.userId);
  if (userIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  const payloadStr = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr
        );
      } catch (err: unknown) {
        // Remove expired/invalid subscriptions
        if (err && typeof err === "object" && "statusCode" in err) {
          const statusCode = (err as { statusCode: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }
    })
  );
}
