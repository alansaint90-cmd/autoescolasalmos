import { loadEnvFile } from "node:process";
import postgres from "postgres";
import Redis from "ioredis";

try {
  loadEnvFile(".env");
} catch {
  // Production usually provides environment variables through the platform.
}

const databaseUrl = process.env.DATABASE_URL ?? "postgres://auto_pro_ia:auto_pro_ia@localhost:5432/auto_pro_ia";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const allowReset = process.env.ALLOW_CONVERSATION_RESET === "true";
const resetConfirm = process.env.RESET_CONFIRM === "RESET_CONVERSATIONS";

function assertResetIsAllowed() {
  if (!allowReset || !resetConfirm) {
    console.error(
      [
        "[reset-conversations] blocked",
        "This command deletes leads, conversations, messages and Redis conversation memory.",
        "Set ALLOW_CONVERSATION_RESET=true and RESET_CONFIRM=RESET_CONVERSATIONS to run it."
      ].join("\n")
    );
    process.exit(1);
  }
}

async function countRows(sql) {
  const [counts] = await sql`
    select
      (select count(*) from leads) as total_leads,
      (select count(*) from conversations) as total_conversations,
      (select count(*) from messages) as total_messages,
      (select count(*) from handoff_events) as total_handoff_events,
      (select count(*) from ai_decision_logs) as total_ai_decision_logs,
      (select count(*) from crm_notifications) as total_crm_notifications,
      (select count(*) from payment_receipts) as total_payment_receipts,
      (select count(*) from leads where is_deleted = false) as leads,
      (select count(*) from conversations where is_deleted = false) as conversations,
      (select count(*) from messages where is_deleted = false) as messages,
      (select count(*) from handoff_events where is_deleted = false) as handoff_events,
      (select count(*) from ai_decision_logs where is_deleted = false) as ai_decision_logs,
      (select count(*) from crm_notifications where is_deleted = false) as crm_notifications,
      (select count(*) from payment_receipts where is_deleted = false) as payment_receipts
  `;

  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, Number(value ?? 0)])
  );
}

async function deleteOperationalData(sql) {
  return sql.begin(async (tx) => {
    const before = await countRows(tx);

    const deletedNotifications = await tx`delete from crm_notifications returning id`;
    const deletedReceipts = await tx`delete from payment_receipts returning id`;
    const deletedAiLogs = await tx`delete from ai_decision_logs returning id`;
    const deletedHandoffEvents = await tx`delete from handoff_events returning id`;
    const deletedMessages = await tx`delete from messages returning id`;
    const deletedConversations = await tx`delete from conversations returning id`;
    const deletedLeads = await tx`delete from leads returning id`;

    return {
      before,
      deleted: {
        aiDecisionLogs: deletedAiLogs.length,
        crmNotifications: deletedNotifications.length,
        paymentReceipts: deletedReceipts.length,
        handoffEvents: deletedHandoffEvents.length,
        messages: deletedMessages.length,
        conversations: deletedConversations.length,
        leads: deletedLeads.length
      }
    };
  });
}

async function clearConversationRedis() {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });

  let deleted = 0;
  const patterns = [
    "conversation:*:buffer",
    "conversation:*:processing",
    "conversation:*:recent-context"
  ];

  try {
    await redis.connect();

    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 250);
        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += await redis.del(...keys);
        }
      } while (cursor !== "0");
    }
  } finally {
    redis.disconnect();
  }

  return deleted;
}

async function main() {
  assertResetIsAllowed();

  const sql = postgres(databaseUrl, { prepare: false });

  try {
    const dbResult = await deleteOperationalData(sql);
    const redisKeysDeleted = await clearConversationRedis();

    console.log(JSON.stringify({
      ok: true,
      warning: "Operational conversation memory was reset. Users, settings, prompts, integrations and company profile were preserved.",
      database: dbResult,
      redis: {
        urlConfigured: Boolean(redisUrl),
        deletedConversationKeys: redisKeysDeleted
      }
    }, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[reset-conversations] failed", error);
  process.exitCode = 1;
});
