import { env } from "@/lib/env";

type SendTextInput = {
  phone: string;
  text: string;
};

export type EvolutionMessageKey = {
  id: string;
  remoteJid?: string;
  fromMe?: boolean;
  participant?: string;
};

export type EvolutionSendResult = {
  raw: unknown;
  key?: EvolutionMessageKey;
  messageId?: string;
  remoteJid?: string;
  status?: string;
};

export type SendMediaInput = {
  phone: string;
  mediaType: "audio" | "image" | "video";
  mediaDataUrl: string;
  fileName: string;
  caption?: string;
};

type ProfilePictureResponse = {
  profilePictureUrl?: string;
  profilePicUrl?: string;
  picture?: string;
  url?: string;
  data?: {
    profilePictureUrl?: string;
    profilePicUrl?: string;
    picture?: string;
    url?: string;
  };
};

export async function sendWhatsAppText(input: SendTextInput) {
  const parts = splitWhatsAppText(input.text);

  if (parts.length > 1) {
    const results: EvolutionSendResult[] = [];
    for (const part of parts) {
      results.push(await sendSingleWhatsAppText({ ...input, text: part }));
      await wait(650);
    }
    return results;
  }

  return sendSingleWhatsAppText({ ...input, text: parts[0] ?? sanitizeWhatsAppText(input.text) });
}

export async function updateWhatsAppText(input: {
  phone: string;
  text: string;
  key: EvolutionMessageKey;
}) {
  const url = new URL(`/chat/updateMessage/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);
  const maskedPhone = input.phone.replace(/\d(?=\d{4})/g, "*");

  console.info("[evolution-api] updating text", {
    url: url.toString(),
    phone: maskedPhone,
    messageId: input.key.id
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number: input.phone.replace(/\D/g, ""),
      text: sanitizeWhatsAppText(input.text),
      key: {
        remoteJid: input.key.remoteJid,
        fromMe: input.key.fromMe ?? true,
        id: input.key.id
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("[evolution-api] update failed", { status: response.status, body: errorBody });
    throw new Error(`Evolution API falhou ao editar mensagem: ${response.status}`);
  }

  console.info("[evolution-api] update success", { status: response.status });
}

export async function deleteWhatsAppMessageForEveryone(input: {
  key: EvolutionMessageKey;
}) {
  const url = new URL(`/chat/deleteMessageForEveryone/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);

  console.info("[evolution-api] deleting message for everyone", {
    url: url.toString(),
    messageId: input.key.id
  });

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      apikey: env.EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      id: input.key.id,
      remoteJid: input.key.remoteJid,
      fromMe: input.key.fromMe ?? true,
      participant: input.key.participant
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("[evolution-api] delete failed", { status: response.status, body: errorBody });
    throw new Error(`Evolution API falhou ao apagar mensagem: ${response.status}`);
  }

  console.info("[evolution-api] delete success", { status: response.status });
  return response.json().catch(() => null) as Promise<unknown>;
}

export async function sendWhatsAppMedia(input: SendMediaInput) {
  const url = new URL(`/message/sendMedia/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);
  const maskedPhone = input.phone.replace(/\d(?=\d{4})/g, "*");
  const media = stripDataUrlPrefix(input.mediaDataUrl);

  console.info("[evolution-api] sending media", {
    url: url.toString(),
    phone: maskedPhone,
    mediaType: input.mediaType,
    fileName: input.fileName
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number: input.phone,
      mediatype: input.mediaType,
      media,
      caption: input.caption ? sanitizeWhatsAppText(input.caption) : undefined,
      fileName: input.fileName
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("[evolution-api] media send failed", { status: response.status, body: errorBody });
    throw new Error(`Evolution API falhou ao enviar midia: ${response.status}`);
  }

  console.info("[evolution-api] media send success", { status: response.status });
  const data = await response.json().catch(() => null);
  return normalizeSendResponse(data);
}

export async function fetchWhatsAppProfilePicture(phone: string) {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) return null;

  const url = new URL(`/chat/fetchProfilePictureUrl/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: cleanPhone
      })
    });

    if (!response.ok) {
      console.warn("[evolution-api] profile picture fetch skipped", { status: response.status });
      return null;
    }

    const data = await response.json().catch(() => null) as ProfilePictureResponse | null;
    const avatarUrl = data?.profilePictureUrl
      ?? data?.profilePicUrl
      ?? data?.picture
      ?? data?.url
      ?? data?.data?.profilePictureUrl
      ?? data?.data?.profilePicUrl
      ?? data?.data?.picture
      ?? data?.data?.url
      ?? null;

    return typeof avatarUrl === "string" && avatarUrl.startsWith("http") ? avatarUrl : null;
  } catch (error) {
    console.warn("[evolution-api] profile picture fetch failed", error);
    return null;
  }
}

async function sendSingleWhatsAppText(input: SendTextInput) {
  const url = new URL(`/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);
  const maskedPhone = input.phone.replace(/\d(?=\d{4})/g, "*");

  console.info("[evolution-api] sending text", {
    url: url.toString(),
    phone: maskedPhone
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number: input.phone,
      text: input.text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("[evolution-api] send failed", { status: response.status, body: errorBody });
    throw new Error(`Evolution API falhou ao enviar mensagem: ${response.status}`);
  }

  console.info("[evolution-api] send success", { status: response.status });
  const data = await response.json().catch(() => null);
  return normalizeSendResponse(data);
}

export function normalizeEvolutionSendResults(result: EvolutionSendResult | EvolutionSendResult[]) {
  return Array.isArray(result) ? result : [result];
}

function normalizeSendResponse(data: unknown): EvolutionSendResult {
  const key = findEvolutionMessageKey(data);
  return {
    raw: data,
    key,
    messageId: key?.id,
    remoteJid: key?.remoteJid,
    status: findStringProperty(data, "status")
  };
}

function findEvolutionMessageKey(value: unknown): EvolutionMessageKey | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as Record<string, unknown>;
  const explicitKey = findEvolutionMessageKey(candidate.key);
  if (explicitKey) return explicitKey;

  if (typeof candidate.messageId === "string") {
    return {
      id: candidate.messageId,
      remoteJid: typeof candidate.remoteJid === "string" ? candidate.remoteJid : undefined,
      fromMe: typeof candidate.fromMe === "boolean" ? candidate.fromMe : undefined,
      participant: typeof candidate.participant === "string" ? candidate.participant : undefined
    };
  }

  if (typeof candidate.id === "string") {
    return {
      id: candidate.id,
      remoteJid: typeof candidate.remoteJid === "string" ? candidate.remoteJid : undefined,
      fromMe: typeof candidate.fromMe === "boolean" ? candidate.fromMe : undefined,
      participant: typeof candidate.participant === "string" ? candidate.participant : undefined
    };
  }

  for (const nested of Object.values(candidate)) {
    const found = findEvolutionMessageKey(nested);
    if (found) return found;
  }

  return undefined;
}

function findStringProperty(value: unknown, property: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate[property] === "string") return candidate[property];

  for (const nested of Object.values(candidate)) {
    const found = findStringProperty(nested, property);
    if (found) return found;
  }

  return undefined;
}

function splitWhatsAppText(text: string) {
  return text
    .split(/\s*\|{3}\s*SPLIT\s*\|{3}\s*/gi)
    .map((part) => sanitizeWhatsAppText(part))
    .filter(Boolean);
}

function stripDataUrlPrefix(value: string) {
  const [, payload] = value.match(/^data:[^;]+;base64,(.+)$/i) ?? [];
  return payload ?? value;
}

export function sanitizeWhatsAppText(text: string) {
  return text
    .replace(/\s*\|{3}\s*SPLIT\s*\|{3}\s*/gi, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
