import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("[pause-legacy-follow-ups] DATABASE_URL ou POSTGRES_URL nao configurada.");
  process.exit(1);
}

if (process.env.ALLOW_LEGACY_FOLLOWUP_PAUSE !== "true") {
  console.error("[pause-legacy-follow-ups] Bloqueado. Defina ALLOW_LEGACY_FOLLOWUP_PAUSE=true para confirmar.");
  process.exit(1);
}

if (process.env.PAUSE_CONFIRM !== "PAUSE_LEGACY_FOLLOWUPS") {
  console.error("[pause-legacy-follow-ups] Bloqueado. Defina PAUSE_CONFIRM=PAUSE_LEGACY_FOLLOWUPS para confirmar.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  const candidates = await sql`
    select id, name, phone, follow_up_count, next_follow_up_at, pipeline_stage
    from leads
    where is_deleted = false
      and follow_up_paused_at is null
      and (
        next_follow_up_at is not null
        or coalesce(follow_up_count, 0) > 0
        or pipeline_stage = 'followup'
      )
      and not exists (
        select 1
        from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as tag(value)
        where lower(tag.value) = 'followup_eligible'
      )
    order by updated_at desc
  `;

  console.info("[pause-legacy-follow-ups] leads antigos em fluxo encontrados", {
    count: candidates.length,
    leads: candidates.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      followUpCount: lead.follow_up_count,
      nextFollowUpAt: lead.next_follow_up_at,
      pipelineStage: lead.pipeline_stage
    }))
  });

  if (candidates.length === 0) {
    console.info("[pause-legacy-follow-ups] Nada para pausar.");
    process.exit(0);
  }

  const paused = await sql`
    update leads
    set
      next_follow_up_at = null,
      follow_up_paused_at = now(),
      updated_at = now()
    where id in ${sql(candidates.map((lead) => lead.id))}
    returning id, name, phone
  `;

  console.info("[pause-legacy-follow-ups] follow-ups antigos pausados", {
    count: paused.length,
    leads: paused
  });
} catch (error) {
  console.error("[pause-legacy-follow-ups] falhou", error);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
