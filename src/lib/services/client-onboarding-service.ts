import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { clientOnboardings, clients } from "@/lib/db/schema";
import { env } from "@/lib/env";

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

export async function generateOnboardingLink(clientId: string, modifiedBy: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashOnboardingToken(token);
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
    url: publicOnboardingUrl(token)
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
