import { eq } from "drizzle-orm";
import { appSettings } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import {
  integrationSettingsKey,
  normalizeIntegrationSettings,
  type IntegrationSettings
} from "@/lib/integration-settings";

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  try {
    const [record] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, integrationSettingsKey))
      .limit(1);

    return normalizeIntegrationSettings(record?.value);
  } catch (error) {
    console.warn("[integration-settings] using defaults", error);
    return normalizeIntegrationSettings(null);
  }
}

export async function saveIntegrationSettings(input: unknown) {
  const settings = normalizeIntegrationSettings(input);

  await db
    .insert(appSettings)
    .values({
      key: integrationSettingsKey,
      value: settings as unknown as Record<string, unknown>
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: settings as unknown as Record<string, unknown>,
        updated_at: new Date()
      }
    });

  return settings;
}
