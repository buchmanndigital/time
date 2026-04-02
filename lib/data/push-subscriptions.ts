import { randomUUID } from "crypto";
import { getSql } from "@/lib/neon";

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: Date;
  updated_at: Date;
};

export async function upsertPushSubscription(
  userId: string,
  data: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  const sql = getSql();
  const id = randomUUID();
  await sql`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (${id}, ${userId}, ${data.endpoint}, ${data.p256dh}, ${data.auth})
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      updated_at = NOW()
  `;
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM push_subscriptions
    WHERE endpoint = ${endpoint}
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function listPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, user_id, endpoint, p256dh, auth, created_at, updated_at
    FROM push_subscriptions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `) as PushSubscriptionRow[];
}

export async function listDistinctUserIdsWithPushSubscriptions(): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT user_id AS user_id
    FROM push_subscriptions
  `) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

/** true wenn Zeile neu eingefügt (noch keine Push für dieses Ereignis). */
export async function tryInsertTaskPushSent(
  taskId: string,
  kind: "pre" | "start",
  startsAtUtc: Date,
): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO task_push_sent (task_id, kind, starts_at_utc)
    VALUES (${taskId}, ${kind}, ${startsAtUtc})
    ON CONFLICT (task_id, kind, starts_at_utc) DO NOTHING
    RETURNING task_id
  `) as { task_id: string }[];
  return rows.length > 0;
}
