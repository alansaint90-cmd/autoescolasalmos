import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "admin", "gerente", "atendente", "operador", "visualizador", "ia"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["ai", "human", "paused", "closed"]);
export const messageRoleEnum = pgEnum("message_role", ["lead", "ai", "human", "system"]);
export const channelEnum = pgEnum("channel", ["whatsapp"]);

const baseAuditColumns = {
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  is_deleted: boolean("is_deleted").notNull().default(false)
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("operador"),
  password_hash: text("password_hash"),
  password_set_at: timestamp("password_set_at", { withTimezone: true }),
  email_verified_at: timestamp("email_verified_at", { withTimezone: true }),
  invite_token_hash: text("invite_token_hash"),
  invite_expires_at: timestamp("invite_expires_at", { withTimezone: true }),
  invited_at: timestamp("invited_at", { withTimezone: true }),
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  ...baseAuditColumns,
  modified_by: uuid("modified_by").notNull()
});

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    phone: text("phone").notNull().unique(),
    avatar_url: text("avatar_url"),
    origin: text("origin").notNull().default("whatsapp"),
    interest: text("interest"),
    temperature: text("temperature").notNull().default("morno"),
    sentiment: text("sentiment").notNull().default("neutro"),
    commercial_status: text("commercial_status").notNull().default("pendente"),
    pipeline_stage: text("pipeline_stage").notNull().default("novo"),
    last_message_preview: text("last_message_preview"),
    last_interaction_at: timestamp("last_interaction_at", { withTimezone: true }),
    enrollment_closed_at: timestamp("enrollment_closed_at", { withTimezone: true }),
    follow_up_count: integer("follow_up_count").notNull().default(0),
    last_follow_up_at: timestamp("last_follow_up_at", { withTimezone: true }),
    next_follow_up_at: timestamp("next_follow_up_at", { withTimezone: true }),
    follow_up_paused_at: timestamp("follow_up_paused_at", { withTimezone: true }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    responsible_id: uuid("responsible_id").references(() => users.id, { onDelete: "restrict" }),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    phoneIdx: index("leads_phone_idx").on(table.phone),
    activityIdx: index("leads_activity_idx").on(table.is_deleted, table.last_interaction_at, table.updated_at, table.created_at),
    stageIdx: index("leads_stage_idx").on(table.is_deleted, table.pipeline_stage),
    originIdx: index("leads_origin_idx").on(table.is_deleted, table.origin),
    temperatureIdx: index("leads_temperature_idx").on(table.is_deleted, table.temperature),
    sentimentIdx: index("leads_sentiment_idx").on(table.is_deleted, table.sentiment),
    responsibleIdx: index("leads_responsible_idx").on(table.is_deleted, table.responsible_id),
    followUpDueIdx: index("leads_follow_up_due_idx").on(table.is_deleted, table.follow_up_paused_at, table.next_follow_up_at, table.follow_up_count)
  })
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lead_id: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "restrict" }),
    channel: channelEnum("channel").notNull().default("whatsapp"),
    external_chat_id: text("external_chat_id").notNull(),
    status: conversationStatusEnum("status").notNull().default("ai"),
    assigned_to: uuid("assigned_to").references(() => users.id, { onDelete: "restrict" }),
    ai_paused_reason: text("ai_paused_reason"),
    last_message_at: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    context_summary: text("context_summary"),
    archived_at: timestamp("archived_at", { withTimezone: true }),
    muted_at: timestamp("muted_at", { withTimezone: true }),
    pinned_at: timestamp("pinned_at", { withTimezone: true }),
    blocked_at: timestamp("blocked_at", { withTimezone: true }),
    cleared_at: timestamp("cleared_at", { withTimezone: true }),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    externalChatIdx: index("conversations_external_chat_idx").on(table.external_chat_id),
    leadIdx: index("conversations_lead_idx").on(table.lead_id),
    activeLastMessageIdx: index("conversations_active_last_message_idx").on(table.is_deleted, table.last_message_at),
    leadLastMessageIdx: index("conversations_lead_last_message_idx").on(table.lead_id, table.is_deleted, table.last_message_at),
    statusIdx: index("conversations_status_idx").on(table.is_deleted, table.status)
  })
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversation_id: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "restrict" }),
    external_message_id: text("external_message_id"),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversation_id),
    conversationCreatedIdx: index("messages_conversation_created_idx").on(table.conversation_id, table.is_deleted, table.created_at),
    externalMessageIdx: uniqueIndex("messages_external_message_unique_idx").on(table.external_message_id)
  })
);

export const handoffEvents = pgTable("handoff_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversation_id: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "restrict" }),
  from_status: conversationStatusEnum("from_status").notNull(),
  to_status: conversationStatusEnum("to_status").notNull(),
  reason: text("reason"),
  ...baseAuditColumns,
  modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
});

export const aiDecisionLogs = pgTable(
  "ai_decision_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversation_id: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    lead_id: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    message_id: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    model: text("model"),
    mode: text("mode"),
    safety_status: text("safety_status").notNull().default("ok"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    conversationIdx: index("ai_decision_logs_conversation_idx").on(table.conversation_id),
    leadIdx: index("ai_decision_logs_lead_idx").on(table.lead_id),
    actionIdx: index("ai_decision_logs_action_idx").on(table.action),
    createdAtIdx: index("ai_decision_logs_created_at_idx").on(table.created_at)
  })
);

export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lead_id: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "restrict" }),
    conversation_id: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "restrict" }),
    message_id: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    status: text("status").notNull().default("aguardando_validacao"),
    detected: boolean("detected").notNull().default(false),
    file_url: text("file_url"),
    file_name: text("file_name"),
    mime_type: text("mime_type"),
    amount_text: text("amount_text"),
    paid_at_text: text("paid_at_text"),
    payer_name: text("payer_name"),
    receiver_name: text("receiver_name"),
    bank_name: text("bank_name"),
    transaction_id: text("transaction_id"),
    raw_text: text("raw_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    leadIdx: index("payment_receipts_lead_idx").on(table.lead_id),
    conversationIdx: index("payment_receipts_conversation_idx").on(table.conversation_id),
    statusIdx: index("payment_receipts_status_idx").on(table.status)
  })
);

export const crmNotifications = pgTable(
  "crm_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lead_id: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    conversation_id: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    message_id: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("unread"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    read_at: timestamp("read_at", { withTimezone: true }),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    leadIdx: index("crm_notifications_lead_idx").on(table.lead_id),
    statusIdx: index("crm_notifications_status_idx").on(table.status),
    createdAtIdx: index("crm_notifications_created_at_idx").on(table.created_at)
  })
);

export const systemEventLogs = pgTable(
  "system_event_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    event: text("event").notNull(),
    severity: text("severity").notNull().default("info"),
    message: text("message").notNull(),
    lead_id: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    conversation_id: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...baseAuditColumns,
    modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict" })
  },
  (table) => ({
    sourceIdx: index("system_event_logs_source_idx").on(table.source),
    severityIdx: index("system_event_logs_severity_idx").on(table.severity),
    createdAtIdx: index("system_event_logs_created_at_idx").on(table.created_at)
  })
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
