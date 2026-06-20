import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const aiControlSettingsKey = "auto-pro-ia:ai-control";
const redisAiControlSettingsKey = "settings:auto-pro-ia:ai-control";
let redisClient: Redis | null = null;

export type AiControlSettings = {
  whatsappPaused: boolean;
  pausedReason: string;
  updatedAt?: string;
};

const defaultAiControlSettings: AiControlSettings = {
  whatsappPaused: false,
  pausedReason: ""
};

function normalizeAiControlSettings(value: unknown): AiControlSettings {
  const partial = typeof value === "object" && value !== null ? (value as Partial<AiControlSettings>) : {};

  return {
    whatsappPaused: Boolean(partial.whatsappPaused),
    pausedReason: partial.pausedReason?.trim() ?? "",
    updatedAt: partial.updatedAt
  };
}

export async function getAiControlSettings() {
  const redisSettings = await getAiControlSettingsFromRedis();
  if (redisSettings) return redisSettings;

  try {
    const [record] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, aiControlSettingsKey))
      .limit(1);

    return normalizeAiControlSettings(record?.value);
  } catch (error) {
    console.warn("[ai-control] using defaults", error);
    return defaultAiControlSettings;
  }
}

export async function saveAiControlSettings(input: Partial<AiControlSettings>) {
  const settings = normalizeAiControlSettings({
    ...defaultAiControlSettings,
    ...input,
    updatedAt: new Date().toISOString()
  });

  await saveAiControlSettingsToRedis(settings);

  try {
    await db
      .insert(appSettings)
      .values({
        key: aiControlSettingsKey,
        value: settings as unknown as Record<string, unknown>
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: settings as unknown as Record<string, unknown>,
          updated_at: new Date()
        }
      });
  } catch (error) {
    console.warn("[ai-control] saved in redis but database did not confirm", error);
  }

  return settings;
}

export async function isWhatsAppAiPaused() {
  const settings = await getAiControlSettings();
  return settings.whatsappPaused;
}

async function getAiControlSettingsFromRedis() {
  try {
    const raw = await getRedis().get(redisAiControlSettingsKey);
    if (!raw) return null;
    return normalizeAiControlSettings(JSON.parse(raw));
  } catch (error) {
    console.warn("[ai-control] redis fallback unavailable", error);
    return null;
  }
}

async function saveAiControlSettingsToRedis(settings: AiControlSettings) {
  try {
    await getRedis().set(redisAiControlSettingsKey, JSON.stringify(settings));
  } catch (error) {
    console.warn("[ai-control] failed to save redis fallback", error);
  }
}

function getRedis() {
  redisClient ??= new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });

  return redisClient;
}
