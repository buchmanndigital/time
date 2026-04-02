import webpush from "web-push";
import {
  deletePushSubscriptionByEndpoint,
  listDistinctUserIdsWithPushSubscriptions,
  listPushSubscriptionsForUser,
  tryInsertTaskPushSent,
} from "@/lib/data/push-subscriptions";
import { listTasksScheduledInWindowForUser } from "@/lib/data/tasks";
import { computeDueNotifications, type NotifyTaskPayload } from "@/lib/task-browser-notify";
import { getVapidConfig } from "./vapid";

export type TaskPushCronResult = {
  ok: boolean;
  error?: string;
  summary?: { users: number; notificationsSent: number };
};

function toNotifyPayload(row: {
  id: string;
  title: string;
  starts_at: Date;
  status: string;
}): NotifyTaskPayload {
  return {
    id: row.id,
    title: row.title,
    starts_at:
      row.starts_at instanceof Date ? row.starts_at.toISOString() : String(row.starts_at),
    status: row.status,
  };
}

/**
 * Sendet fällige Aufgaben-Pushes an alle gemerkten Geräte (Cron, Node).
 */
export async function runTaskPushCron(): Promise<TaskPushCronResult> {
  const vapid = getVapidConfig();
  if (!vapid) {
    return { ok: false, error: "VAPID_* nicht konfiguriert." };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const now = Date.now();
  const from = new Date(now - 60 * 60 * 1000);
  const to = new Date(now + 48 * 60 * 60 * 1000);
  const nowDate = new Date();

  const userIds = await listDistinctUserIdsWithPushSubscriptions();
  let pushed = 0;

  for (const userId of userIds) {
    const subs = await listPushSubscriptionsForUser(userId);
    if (subs.length === 0) continue;

    const taskRows = await listTasksScheduledInWindowForUser(userId, from, to);
    const tasks = taskRows.map(toNotifyPayload);
    const due = computeDueNotifications(tasks, nowDate);

    for (const n of due) {
      const startsAt = new Date(n.startsAtIso);
      if (Number.isNaN(startsAt.getTime())) continue;

      const inserted = await tryInsertTaskPushSent(n.taskId, n.kind, startsAt);
      if (!inserted) continue;

      const payload = JSON.stringify({
        title: n.title,
        body: n.body,
        tag: n.tag,
        lang: "de",
      });

      for (const row of subs) {
        const subscription = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: 120,
            urgency: "high",
          });
          pushed += 1;
        } catch (e: unknown) {
          const statusCode =
            e && typeof e === "object" && "statusCode" in e
              ? (e as { statusCode?: number }).statusCode
              : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await deletePushSubscriptionByEndpoint(row.endpoint);
          }
        }
      }
    }
  }

  return {
    ok: true,
    summary: {
      users: userIds.length,
      notificationsSent: pushed,
    },
  };
}
