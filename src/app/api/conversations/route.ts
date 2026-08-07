import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { triggerDueFollowUpsInBackground } from "@/lib/services/follow-up-service";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

type ConversationRow = {
  conversation_id: string;
  status: "ai" | "human" | "paused" | "closed";
  last_message_at: Date | string | null;
  archived_at: Date | string | null;
  muted_at: Date | string | null;
  pinned_at: Date | string | null;
  blocked_at: Date | string | null;
  cleared_at: Date | string | null;
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  origin: string | null;
  tags: unknown;
  temperature: string | null;
  sentiment: string | null;
  commercial_status: string | null;
  pipeline_stage: string | null;
  last_message_preview: string | null;
  last_interaction_at: Date | string | null;
  follow_up_count: string | number | bigint;
  last_follow_up_at: Date | string | null;
  next_follow_up_at: Date | string | null;
  follow_up_paused_at: Date | string | null;
  interest: string | null;
  responsible_name: string | null;
};

type ConversationMessageRow = {
  conversation_id: string;
  id: string;
  role: "lead" | "ai" | "human" | "system";
  content: string;
  created_at: Date | string;
  metadata: Record<string, unknown> | null;
};

type ConversationCountsRow = {
  all_count: string | number | bigint;
  ad_count: string | number | bigint;
  follow_up_count: string | number | bigint;
};

function formatTime(value: Date | string | null) {
  if (!value) return "agora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "ontem" : `${diffDays} dias`;
}

function initialsFromName(name: string) {
  const initials = name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "LD";
}

function isLikelyBusinessProfileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return [
    "auto escola renacer",
    "autoescola renacer",
    "cfc renacer",
    "auto pro ia",
    "auto pro ia crm"
  ].includes(normalized);
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePipelineStage(stage: string | null | undefined) {
  const value = stage ?? "novo";
  if (value === "qualificado" || value === "orcamento") return "atendimento";
  if (value === "negociacao" || value === "interessado" || value === "interessado_followup") return "followup";
  if (value === "matricula_realizada") return "fechado";
  if (["novo", "ia", "atendimento", "followup", "matricula_pendente", "fechado", "perdido"].includes(value)) return value;
  return "novo";
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeLeadTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
}

function isAdsOrigin(origin: string | null | undefined) {
  const normalized = normalizeComparable(origin ?? "");
  return (
    normalized.includes("meta ads")
    || normalized.includes("facebook ads")
    || normalized.includes("instagram ads")
  );
}

function isAdLead(origin: string | null | undefined, tagsValue: unknown) {
  if (isAdsOrigin(origin)) return true;

  const tags = normalizeLeadTags(tagsValue).map(normalizeComparable);
  return tags.some((tag) => (
    tag === "anuncio"
    || tag === "meta"
    || tag === "meta ads"
    || tag === "facebook"
    || tag === "facebook ads"
    || tag === "instagram"
    || tag === "instagram ads"
  ));
}

function toNumber(value: string | number | bigint | null | undefined) {
  return Number(value ?? 0);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "viewLeads");
    triggerDueFollowUpsInBackground({ source: "conversations-api", limit: 10 });

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 80), 1), 120);
    const messageLimit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("messages") ?? 25), 1), 40);

    const rows = await db.execute<ConversationRow>(sql`
      select
        c.id as conversation_id,
        c.status,
        c.last_message_at,
        c.archived_at,
        c.muted_at,
        c.pinned_at,
        c.blocked_at,
        c.cleared_at,
        l.id as lead_id,
        l.name as lead_name,
        l.phone,
        l.avatar_url,
        l.origin,
        l.tags,
        l.temperature,
        l.sentiment,
        l.commercial_status,
        l.pipeline_stage,
        l.last_message_preview,
        l.last_interaction_at,
        l.follow_up_count,
        l.last_follow_up_at,
        l.next_follow_up_at,
        l.follow_up_paused_at,
        l.interest,
        u.name as responsible_name
      from conversations c
      inner join leads l on l.id = c.lead_id and l.is_deleted = false
      left join users u on u.id = c.assigned_to and u.is_deleted = false
      where c.is_deleted = false
      order by c.last_message_at desc
      limit ${limit}
    `);

    const conversationIds = rows.map((row) => row.conversation_id);
    const messagesByConversation = await loadRecentMessagesByConversation(conversationIds, messageLimit);
    const [counts] = await db.execute<ConversationCountsRow>(sql`
      select
        count(*) filter (where c.archived_at is null) as all_count,
        count(*) filter (
          where c.archived_at is null
            and (
              lower(coalesce(l.origin, '')) like '%meta ads%'
              or lower(coalesce(l.origin, '')) like '%facebook ads%'
              or lower(coalesce(l.origin, '')) like '%instagram ads%'
              or exists (
                select 1
                from jsonb_array_elements_text(coalesce(l.tags, '[]'::jsonb)) as tag(value)
                where lower(tag.value) in (
                  'anuncio',
                  'meta',
                  'meta ads',
                  'facebook',
                  'facebook ads',
                  'instagram',
                  'instagram ads'
                )
              )
            )
        ) as ad_count,
        count(*) filter (
          where c.archived_at is null
            and c.status = 'ai'
            and l.follow_up_paused_at is null
            and (
              coalesce(l.follow_up_count, 0) > 0
              or l.last_follow_up_at is not null
              or l.next_follow_up_at is not null
              or l.pipeline_stage = 'followup'
            )
            and (
              lower(coalesce(l.origin, '')) like '%meta ads%'
              or lower(coalesce(l.origin, '')) like '%facebook ads%'
              or lower(coalesce(l.origin, '')) like '%instagram ads%'
              or exists (
                select 1
                from jsonb_array_elements_text(coalesce(l.tags, '[]'::jsonb)) as tag(value)
                where lower(tag.value) in (
                  'anuncio',
                  'meta',
                  'meta ads',
                  'facebook',
                  'facebook ads',
                  'instagram',
                  'instagram ads'
                )
              )
            )
        ) as follow_up_count
      from conversations c
      inner join leads l on l.id = c.lead_id and l.is_deleted = false
      where c.is_deleted = false
    `);

    const conversations = rows.map((row) => {
      const phone = row.phone?.trim() || "Contato sem telefone";
      const rawName = row.lead_name?.trim();
      const name = rawName && !isLikelyBusinessProfileName(rawName) ? rawName : phone;
      const conversationMessages = messagesByConversation.get(row.conversation_id) ?? [];
      const lastMessage = conversationMessages.at(-1)?.content ?? row.last_message_preview ?? "";
      const tags = normalizeLeadTags(row.tags);

      return {
        id: row.conversation_id,
        archived: Boolean(row.archived_at),
        muted: Boolean(row.muted_at),
        pinned: Boolean(row.pinned_at),
        blocked: Boolean(row.blocked_at),
        cleared: Boolean(row.cleared_at),
        lead: {
          id: row.lead_id,
          name,
          phone,
          origin: row.origin ?? "WhatsApp",
          tags,
          isAdLead: isAdLead(row.origin, tags),
          temperature: row.temperature ?? "morno",
          commercialStatus: row.commercial_status ?? "em_atendimento",
          lastInteraction: formatTime(row.last_interaction_at ?? row.last_message_at),
          responsible: row.responsible_name ?? "Equipe comercial",
          avatar: row.avatar_url ?? "",
          stage: normalizePipelineStage(row.pipeline_stage),
          interest: row.interest ?? "carro",
          notes: row.last_message_preview ?? "",
          sentiment: row.sentiment ?? "neutro",
          followUpCount: Number(row.follow_up_count ?? 0),
          lastFollowUpAt: row.last_follow_up_at ? new Date(row.last_follow_up_at).toISOString() : null,
          nextFollowUpAt: row.next_follow_up_at ? new Date(row.next_follow_up_at).toISOString() : null,
          followUpPausedAt: row.follow_up_paused_at ? new Date(row.follow_up_paused_at).toISOString() : null
        },
        online: false,
        unread: 0,
        preview: lastMessage,
        status: row.status,
        messages: conversationMessages.map((message) => ({
          id: message.id,
          from: message.role === "ai" ? "ia" : message.role === "human" ? "human" : "lead",
          text: message.content,
          time: formatTime(message.created_at),
          senderName: metadataString(message.metadata, "sender"),
          senderRole: metadataString(message.metadata, "senderRole"),
          media: normalizeMessageMedia(message.metadata, message.id)
        })),
        initials: initialsFromName(name)
      };
    });

    return NextResponse.json({
      ok: true,
      conversations,
      count: conversations.length,
      counts: {
        all: toNumber(counts?.all_count),
        adLeads: toNumber(counts?.ad_count),
        followUp: toNumber(counts?.follow_up_count)
      }
    });
  } catch (error) {
    console.error("[conversations-api] failed to load conversations", error);

    const message = error instanceof Error ? error.message : "Nao foi possivel carregar conversas.";
    const isAuthError = /acesso|permiss|sess|login|autoriz/i.test(message);

    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 403 : 500 }
    );
  }
}

async function loadRecentMessagesByConversation(conversationIds: string[], messageLimit: number) {
  const grouped = new Map<string, ConversationMessageRow[]>();
  if (conversationIds.length === 0) return grouped;

  const rows = await db.execute<ConversationMessageRow>(sql`
    with ranked_messages as (
      select
        m.conversation_id,
        m.id,
        m.role,
        m.content,
        m.created_at,
        m.metadata,
        row_number() over (
          partition by m.conversation_id
          order by m.created_at desc
        ) as rn
      from messages m
      inner join conversations c on c.id = m.conversation_id
      where m.conversation_id in (${sql.join(conversationIds.map((id) => sql`${id}`), sql`, `)})
        and m.is_deleted = false
        and (c.cleared_at is null or m.created_at > c.cleared_at)
    )
    select conversation_id, id, role, content, created_at, metadata
    from ranked_messages
    where rn <= ${messageLimit}
    order by conversation_id asc, created_at asc
  `);

  for (const row of rows) {
    const messages = grouped.get(row.conversation_id) ?? [];
    messages.push(row);
    grouped.set(row.conversation_id, messages);
  }

  return grouped;
}

function normalizeMessageMedia(metadata: Record<string, unknown> | null | undefined, messageId: string) {
  const media = metadata && typeof metadata === "object" && typeof metadata.media === "object" && metadata.media !== null
    ? metadata.media as Record<string, unknown>
    : metadata && typeof metadata === "object" && typeof metadata.attachment === "object" && metadata.attachment !== null
      ? metadata.attachment as Record<string, unknown>
      : null;

  if (!media) return undefined;

  const type = typeof media.type === "string" ? media.type : "";
  if (!["audio", "image", "video", "document"].includes(type)) return undefined;

  const mimeType = typeof media.mimeType === "string" ? media.mimeType : undefined;
  const base64 = typeof media.base64 === "string" ? media.base64 : undefined;
  const dataUrl = typeof media.dataUrl === "string" ? media.dataUrl : base64 ? toDataUrl(base64, mimeType) : undefined;
  const hasStoredMedia = typeof media.storageKey === "string" && media.storageKey.trim().length > 0;
  const hasInlineMedia = Boolean(dataUrl);
  const sourceUrl = hasStoredMedia || hasInlineMedia
    ? `/api/media/${messageId}`
    : typeof media.url === "string" ? media.url : undefined;

  return {
    type,
    sourceUrl,
    dataUrl,
    fileName: typeof media.fileName === "string" ? media.fileName : undefined,
    mimeType,
    caption: typeof media.caption === "string" ? media.caption : undefined,
    transcription: typeof media.transcription === "string" ? media.transcription : undefined,
    transcriptionStatus: typeof media.transcriptionStatus === "string" ? media.transcriptionStatus : undefined,
    description: typeof media.description === "string" ? media.description : undefined,
    descriptionStatus: typeof media.descriptionStatus === "string" ? media.descriptionStatus : undefined,
    storageStatus: typeof media.storageStatus === "string" ? media.storageStatus : undefined,
    durationSeconds: typeof media.durationSeconds === "number" ? media.durationSeconds : undefined
  };
}

function toDataUrl(value: string, mimeType?: string) {
  if (value.startsWith("data:")) return value;
  return `data:${mimeType || "application/octet-stream"};base64,${value}`;
}
