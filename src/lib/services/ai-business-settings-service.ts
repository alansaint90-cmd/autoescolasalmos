import { eq } from "drizzle-orm";
import {
  aiBusinessSettingsKey,
  defaultAiBusinessSettings,
  type AiBusinessSettings
} from "@/lib/ai-business-settings";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";

function normalizeSettings(value: unknown): AiBusinessSettings {
  const partial = typeof value === "object" && value !== null ? (value as Partial<AiBusinessSettings>) : {};
  const prices = sanitizeAiBusinessText(partial.prices?.trim() || defaultAiBusinessSettings.prices);
  const address = sanitizeAddress(partial.address?.trim() || defaultAiBusinessSettings.address);
  const hours = partial.hours?.trim() || defaultAiBusinessSettings.hours;
  const customPrompt = sanitizeAiBusinessText(partial.customPrompt?.trim() || defaultAiBusinessSettings.customPrompt);

  return {
    agentName: partial.agentName?.trim() || defaultAiBusinessSettings.agentName,
    prices: shouldUseDefaultExpresso21Base(prices) ? defaultAiBusinessSettings.prices : prices,
    address: shouldUseDefaultExpresso21Address(address) ? defaultAiBusinessSettings.address : address,
    hours: shouldUseDefaultExpresso21Hours(hours) ? defaultAiBusinessSettings.hours : hours,
    customPrompt: shouldUseDefaultExpresso21Base(customPrompt) ? defaultAiBusinessSettings.customPrompt : customPrompt,
    triagePrompt: sanitizeAiBusinessText(partial.triagePrompt?.trim() || defaultAiBusinessSettings.triagePrompt),
    sdrPrompt: sanitizeAiBusinessText(partial.sdrPrompt?.trim() || defaultAiBusinessSettings.sdrPrompt),
    orchestratorPrompt: sanitizeAiBusinessText(partial.orchestratorPrompt?.trim() || defaultAiBusinessSettings.orchestratorPrompt),
    supervisorPrompt: sanitizeAiBusinessText(partial.supervisorPrompt?.trim() || defaultAiBusinessSettings.supervisorPrompt)
  };
}

function shouldUseDefaultExpresso21Base(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("cnh do brasil")
    || normalized.includes("r$ 1.280,00")
    || normalized.includes("taxa de matricula e r$ 120,00")
    || normalized.includes("exame pratico sai por r$ 165,00")
  );
}

function shouldUseDefaultExpresso21Address(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized.includes("endereco da unidade nao cadastrado")
    || normalized.includes("jorge calmom")
    || normalized.includes("santa rita")
  );
}

function shouldUseDefaultExpresso21Hours(hours: string) {
  const normalized = hours.toLowerCase();
  return normalized.includes("18h30") || normalized.includes("sabados");
}

function sanitizeAiBusinessText(text: string) {
  return text
    .replace(/Auto Escola Renacer/g, "Auto Escola Expresso 21")
    .replace(/AUTO ESCOLA RENACER/g, "AUTO ESCOLA EXPRESSO 21")
    .replace(/auto escola renacer/g, "auto escola expresso 21")
    .replace(/Autoescola Renacer/g, "Autoescola Expresso 21")
    .replace(/autoescola renacer/g, "autoescola expresso 21")
    .replace(/CFC Renacer/g, "CFC Expresso 21")
    .replace(/cfc renacer/g, "cfc expresso 21")
    .replace(/laudo\s+psicot[eé]cnico/gi, "laudo")
    .replace(/laudo\s+psicol[oó]gico/gi, "laudo")
    .replace(/psicot[eé]cnico/gi, "avaliacao psicologica")
    .replace(/psicoteste/gi, "avaliacao psicologica")
    .replace(/\batendemos\s+(?:clientes\s+)?pcd[^.\n]*/gi, "nao atendemos PCD no momento, pois nao possuimos veiculos adaptados")
    .replace(/(?:a\s+)?(?:auto\s*escola|cfc)\s+expresso 21\s+atende\s+(?:clientes\s+)?pcd[^.\n]*/gi, "A Auto Escola Expresso 21 nao atende PCD no momento, pois nao possui veiculos adaptados")
    .replace(/(?<!n[aã]o\s)(?:possui|tem|oferece)\s+ve[ií]culos?\s+adaptados?/gi, "nao possui veiculos adaptados");
}

function sanitizeAddress(address: string) {
  return address
    .replace(/Auto Escola Renacer/g, "Auto Escola Expresso 21")
    .replace(/auto escola renacer/g, "auto escola expresso 21")
    .replace(/Autoescola Renacer/g, "Autoescola Expresso 21")
    .replace(/autoescola renacer/g, "autoescola expresso 21")
    .replace(/R\.?\s*Santa\s+Rita,\s*509/gi, "Endereco da unidade nao cadastrado")
    .replace(/Rua\s+Santa\s+Rita,\s*509/gi, "Endereco da unidade nao cadastrado")
    .replace(/Rua\s+Jorge\s+Calmom,\s*215[^.\n]*/gi, "Endereco da unidade nao cadastrado");
}

export async function getAiBusinessSettings(): Promise<AiBusinessSettings> {
  try {
    const [record] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, aiBusinessSettingsKey))
      .limit(1);

    return normalizeSettings(record?.value);
  } catch (error) {
    console.warn("[ai-business-settings] using defaults", error);
    return defaultAiBusinessSettings;
  }
}

export async function saveAiBusinessSettings(input: AiBusinessSettings) {
  const settings = normalizeSettings(input);

  await db
    .insert(appSettings)
    .values({
      key: aiBusinessSettingsKey,
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
