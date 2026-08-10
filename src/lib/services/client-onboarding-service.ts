import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { clientOnboardings, clients } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { onboardingSections } from "@/lib/onboarding-schema";

export type OnboardingStatus = "not_sent" | "waiting" | "in_progress" | "completed";

export type OnboardingResponses = Record<string, unknown>;
export type OnboardingFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  uploadedAt: string;
};

export function statusLabel(status: OnboardingStatus) {
  const labels: Record<OnboardingStatus, string> = {
    not_sent: "Não enviado",
    waiting: "Aguardando preenchimento",
    in_progress: "Em preenchimento",
    completed: "Concluído"
  };

  return labels[status];
}

export function hashOnboardingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function publicOnboardingUrl(token: string) {
  return new URL(`/onboarding/${token}`, env.APP_URL).toString();
}

export async function listClientsWithOnboarding() {
  const rows = await db
    .select({
      client: clients,
      onboarding: clientOnboardings
    })
    .from(clients)
    .leftJoin(
      clientOnboardings,
      and(eq(clientOnboardings.client_id, clients.id), eq(clientOnboardings.is_deleted, false))
    )
    .where(eq(clients.is_deleted, false))
    .orderBy(desc(clients.updated_at));

  return rows.map(({ client, onboarding }) => ({
    ...client,
    onboarding
  }));
}

export async function getClientWithOnboarding(clientId: string) {
  const [row] = await db
    .select({
      client: clients,
      onboarding: clientOnboardings
    })
    .from(clients)
    .leftJoin(
      clientOnboardings,
      and(eq(clientOnboardings.client_id, clients.id), eq(clientOnboardings.is_deleted, false))
    )
    .where(and(eq(clients.id, clientId), eq(clients.is_deleted, false)))
    .limit(1);

  return row ? { ...row.client, onboarding: row.onboarding } : null;
}

export function buildOnboardingPdfLines(input: {
  clientName: string;
  responses: Record<string, unknown>;
  files?: Array<Record<string, unknown>>;
  completedAt?: Date | string | null;
}) {
  const lines = [
    "AUTO PRO IA",
    "Onboarding de Cliente - Base de Conhecimento",
    `Autoescola: ${input.clientName}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    input.completedAt ? `Formulario enviado em: ${new Date(input.completedAt).toLocaleString("pt-BR")}` : "",
    "",
    "Observacao: este documento preserva as respostas informadas pelo cliente, sem resumo, para uso futuro como base de conhecimento do agente de IA.",
    ""
  ].filter(Boolean);

  for (const section of onboardingSections) {
    const rawSectionResponses = input.responses[section.id];
    const sectionResponses: Record<string, unknown> = isRecord(rawSectionResponses)
      ? rawSectionResponses
      : {};
    const sectionLines: string[] = [];

    for (const field of section.fields) {
      const answer = normalizeAnswer(sectionResponses[field.key]);
      if (!answer) continue;

      sectionLines.push(...wrapLine(`Pergunta: ${field.label}`));
      sectionLines.push(...wrapLine(`Resposta: ${answer}`));
      sectionLines.push("");
    }

    if (sectionLines.length > 0) {
      lines.push(section.title);
      lines.push(...sectionLines);
    }
  }

  const files = input.files ?? [];
  if (files.length > 0) {
    lines.push("Materiais anexados");
    for (const file of files) {
      const name = typeof file.name === "string" ? file.name : "Arquivo sem nome";
      const type = typeof file.type === "string" && file.type ? file.type : "tipo nao informado";
      const size = typeof file.size === "number" ? formatBytes(file.size) : "tamanho nao informado";
      lines.push(...wrapLine(`Arquivo: ${name} (${type}, ${size})`));
    }
  }

  return lines.length > 8 ? lines : [
    "AUTO PRO IA",
    "Onboarding de Cliente - Base de Conhecimento",
    `Autoescola: ${input.clientName}`,
    "",
    "Nenhuma resposta preenchida no formulario."
  ];
}

export async function createClient(input: {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  modifiedBy: string;
}) {
  const [client] = await db
    .insert(clients)
    .values({
      name: input.name.trim(),
      contact_name: cleanOptional(input.contactName),
      contact_email: cleanOptional(input.contactEmail),
      contact_phone: cleanOptional(input.contactPhone),
      notes: cleanOptional(input.notes),
      modified_by: input.modifiedBy
    })
    .returning();

  return client;
}

export async function updateClient(input: {
  clientId: string;
  name?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  modifiedBy: string;
}) {
  const [client] = await db
    .update(clients)
    .set({
      name: input.name?.trim(),
      contact_name: cleanOptional(input.contactName),
      contact_email: cleanOptional(input.contactEmail),
      contact_phone: cleanOptional(input.contactPhone),
      notes: cleanOptional(input.notes),
      updated_at: new Date(),
      modified_by: input.modifiedBy
    })
    .where(and(eq(clients.id, input.clientId), eq(clients.is_deleted, false)))
    .returning();

  return client;
}

export async function deleteClientWithOnboarding(clientId: string, modifiedBy: string) {
  const now = new Date();

  await db
    .update(clientOnboardings)
    .set({
      is_deleted: true,
      deleted_at: now,
      updated_at: now,
      modified_by: modifiedBy
    })
    .where(and(eq(clientOnboardings.client_id, clientId), eq(clientOnboardings.is_deleted, false)));

  const [client] = await db
    .update(clients)
    .set({
      is_deleted: true,
      deleted_at: now,
      updated_at: now,
      modified_by: modifiedBy
    })
    .where(and(eq(clients.id, clientId), eq(clients.is_deleted, false)))
    .returning();

  return client;
}

export async function generateOnboardingLink(clientId: string, modifiedBy: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashOnboardingToken(token);
  const url = publicOnboardingUrl(token);
  const now = new Date();

  await db
    .update(clientOnboardings)
    .set({
      is_deleted: true,
      deleted_at: now,
      updated_at: now,
      modified_by: modifiedBy
    })
    .where(and(eq(clientOnboardings.client_id, clientId), eq(clientOnboardings.is_deleted, false)));

  const [onboarding] = await db
    .insert(clientOnboardings)
    .values({
      client_id: clientId,
      token_hash: tokenHash,
      public_url: url,
      status: "waiting",
      modified_by: modifiedBy
    })
    .returning();

  await db
    .update(clients)
    .set({
      onboarding_status: "waiting",
      updated_at: now,
      modified_by: modifiedBy
    })
    .where(and(eq(clients.id, clientId), eq(clients.is_deleted, false)));

  return {
    onboarding,
    token,
    url
  };
}

export async function getPublicOnboarding(token: string) {
  const tokenHash = hashOnboardingToken(token);
  const [row] = await db
    .select({
      client: clients,
      onboarding: clientOnboardings
    })
    .from(clientOnboardings)
    .innerJoin(clients, eq(clients.id, clientOnboardings.client_id))
    .where(and(
      eq(clientOnboardings.token_hash, tokenHash),
      eq(clientOnboardings.is_deleted, false),
      eq(clients.is_deleted, false)
    ))
    .limit(1);

  return row ? { client: row.client, onboarding: row.onboarding } : null;
}

export async function savePublicOnboarding(input: {
  token: string;
  responses: OnboardingResponses;
  files?: OnboardingFile[];
  complete?: boolean;
}) {
  const found = await getPublicOnboarding(input.token);
  if (!found) return null;

  const now = new Date();
  const status: OnboardingStatus = input.complete ? "completed" : "in_progress";

  const [onboarding] = await db
    .update(clientOnboardings)
    .set({
      responses: input.responses,
      files: input.files ?? [],
      status,
      started_at: found.onboarding.started_at ?? now,
      last_saved_at: now,
      completed_at: input.complete ? now : found.onboarding.completed_at,
      pdf_generated_at: input.complete ? now : found.onboarding.pdf_generated_at,
      updated_at: now,
      modified_by: SYSTEM_USER_ID
    })
    .where(eq(clientOnboardings.id, found.onboarding.id))
    .returning();

  await db
    .update(clients)
    .set({
      onboarding_status: status,
      onboarding_completed_at: input.complete ? now : found.client.onboarding_completed_at,
      updated_at: now,
      modified_by: SYSTEM_USER_ID
    })
    .where(eq(clients.id, found.client.id));

  return {
    client: found.client,
    onboarding
  };
}

function cleanOptional(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAnswer(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length > 0) return value.map(normalizeAnswer).filter(Boolean).join("; ");
  if (isRecord(value)) return JSON.stringify(value);
  return "";
}

function wrapLine(value: string, maxLength = 92) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return [clean];

  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "tamanho nao informado";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
