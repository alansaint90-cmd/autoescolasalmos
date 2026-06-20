import { loadEnvFile } from "node:process";
import postgres from "postgres";

try {
  loadEnvFile(".env");
} catch {
  // Production usually provides DATABASE_URL via environment variables.
}

const databaseUrl = process.env.DATABASE_URL ?? "postgres://auto_pro_ia:auto_pro_ia@localhost:5432/auto_pro_ia";

async function main() {
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    await sql.begin(async (tx) => {
      const seedConversations = await tx`
        select c.id, c.lead_id
        from conversations c
        left join leads l on l.id = c.lead_id
        where (
          c.external_chat_id like '55759900%@s.whatsapp.net'
          and coalesce(c.context_summary, '') like 'Seed dashboard:%'
        )
        or exists (
          select 1
          from messages m
          where m.conversation_id = c.id
            and m.external_message_id like 'seed-dashboard-%'
        )
        or (
          l.phone like '55759900%'
          and coalesce(l.last_message_preview, '') in (
            'Matricula confirmada. Cliente concluiu o processo comercial.',
            'Cliente pediu valores e condicoes de parcelamento.',
            'Cliente aguarda retorno para confirmar horario de aula teorica.',
            'IA qualificou interesse e recomendou follow-up comercial.'
          )
        )
      `;

      const conversationIds = seedConversations.map((row) => row.id);
      const leadIds = Array.from(new Set(seedConversations.map((row) => row.lead_id).filter(Boolean)));

      const updatedMessages = conversationIds.length > 0
        ? await tx`
            update messages
            set
              is_deleted = true,
              deleted_at = now(),
              updated_at = now()
            where conversation_id in ${tx(conversationIds)}
              or external_message_id like 'seed-dashboard-%'
            returning id
          `
        : await tx`
            update messages
            set
              is_deleted = true,
              deleted_at = now(),
              updated_at = now()
            where external_message_id like 'seed-dashboard-%'
            returning id
          `;

      const updatedConversations = conversationIds.length > 0
        ? await tx`
            update conversations
            set
              is_deleted = true,
              deleted_at = now(),
              updated_at = now()
            where id in ${tx(conversationIds)}
            returning id
          `
        : [];

      const updatedLeads = leadIds.length > 0
        ? await tx`
            update leads
            set
              is_deleted = true,
              deleted_at = now(),
              updated_at = now()
            where id in ${tx(leadIds)}
            returning id
          `
        : [];

      console.log(JSON.stringify({
        ok: true,
        softDeleted: {
          leads: updatedLeads.length,
          conversations: updatedConversations.length,
          messages: updatedMessages.length
        }
      }, null, 2));
    });
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[cleanup-fake-leads] failed", error);
  process.exitCode = 1;
});
