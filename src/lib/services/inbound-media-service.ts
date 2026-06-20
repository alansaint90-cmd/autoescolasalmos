import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { uploadMediaToMinio } from "@/lib/services/minio-media-service";
import type { NormalizedInboundMessage } from "@/lib/whatsapp/normalizer";

type InboundMedia = NonNullable<NormalizedInboundMessage["media"]>;

type DownloadOptions = {
  remoteJid?: string;
  messageId?: string;
  fromMe?: boolean;
};

export type InboundMediaProcessingResult = {
  media: InboundMedia & {
    storageKey?: string;
    storageStatus?: "stored" | "unavailable" | "error";
    storageError?: string;
    dataUrl?: string;
    sizeBytes?: number;
  };
  buffer?: Buffer;
};

const maxInlineFallbackBytes = 900_000;

export async function processAndStoreInboundMedia(
  media: InboundMedia,
  options: DownloadOptions
): Promise<InboundMediaProcessingResult> {
  const downloaded = await downloadInboundMedia(media, options);
  if (!downloaded) {
    return {
      media: {
        ...media,
        storageStatus: "unavailable",
        storageError: "Midia recebida sem arquivo baixavel pela Evolution."
      }
    };
  }

  const fileName = media.fileName || fileNameForMedia(media, downloaded.mimeType);
  const normalizedMedia = {
    ...media,
    fileName,
    mimeType: downloaded.mimeType,
    base64: undefined,
    sizeBytes: downloaded.buffer.byteLength,
    dataUrl: downloaded.buffer.byteLength <= maxInlineFallbackBytes
      ? toDataUrl(downloaded.buffer, downloaded.mimeType)
      : undefined
  };

  try {
    const stored = await uploadMediaToMinio({
      key: buildStorageKey(media.type, fileName, options.messageId),
      buffer: downloaded.buffer,
      contentType: downloaded.mimeType
    });

    return {
      buffer: downloaded.buffer,
      media: {
        ...normalizedMedia,
        storageKey: stored.storageKey,
        storageStatus: "stored"
      }
    };
  } catch (error) {
    return {
      buffer: downloaded.buffer,
      media: {
        ...normalizedMedia,
        storageStatus: "error",
        storageError: error instanceof Error ? error.message : "Falha ao armazenar midia."
      }
    };
  }
}

export async function downloadInboundMedia(media: InboundMedia, options: DownloadOptions = {}) {
  if (media.base64) {
    const buffer = Buffer.from(stripDataUrlPrefix(media.base64), "base64");
    return {
      buffer,
      mimeType: media.mimeType || mimeTypeForMedia(media.type)
    };
  }

  if (options.messageId && options.remoteJid) {
    const fromEvolution = await getMediaFromEvolution(media, options).catch(() => null);
    if (fromEvolution) return fromEvolution;
  }

  if (!media.url) return null;

  const response = await fetch(media.url, {
    headers: {
      apikey: env.EVOLUTION_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar midia pela URL da Evolution: ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || media.mimeType || mimeTypeForMedia(media.type)
  };
}

async function getMediaFromEvolution(media: InboundMedia, options: DownloadOptions) {
  const url = new URL(`/chat/getBase64FromMediaMessage/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);
  const payloads = [
    {
      message: {
        key: {
          id: options.messageId,
          remoteJid: options.remoteJid,
          fromMe: Boolean(options.fromMe)
        }
      },
      convertToMp4: media.type === "video"
    },
    {
      key: {
        id: options.messageId,
        remoteJid: options.remoteJid,
        fromMe: Boolean(options.fromMe)
      },
      convertToMp4: media.type === "video"
    }
  ];

  let lastError = "";
  for (const payload of payloads) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.EVOLUTION_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const body = await response.text().catch(() => "");
    if (!response.ok) {
      lastError = `${response.status} ${body.slice(0, 220)}`;
      continue;
    }

    const data = parseJson(body);
    const base64 = findBase64(data);
    if (!base64) {
      lastError = "Resposta da Evolution sem base64.";
      continue;
    }

    const mimeType = findMimeType(data) || media.mimeType || mimeTypeForMedia(media.type);
    return {
      buffer: Buffer.from(stripDataUrlPrefix(base64), "base64"),
      mimeType
    };
  }

  if (lastError) throw new Error(`Falha ao obter midia pela Evolution: ${lastError}`);
  return null;
}

function buildStorageKey(type: InboundMedia["type"], fileName: string, messageId?: string) {
  const safeFile = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 90);
  const id = messageId?.replace(/[^\w.\-]+/g, "") || randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  return `whatsapp/${day}/${type}/${id}-${safeFile}`;
}

function toDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function stripDataUrlPrefix(value: string) {
  const [, payload] = value.match(/^data:[^;]+;base64,(.+)$/i) ?? [];
  return payload ?? value;
}

function fileNameForMedia(media: InboundMedia, mimeType?: string) {
  const extension = extensionForMime(mimeType || media.mimeType) || media.type;
  return `${media.type}-recebido.${extension}`;
}

function mimeTypeForMedia(type: InboundMedia["type"]) {
  if (type === "audio") return "audio/ogg";
  if (type === "image") return "image/jpeg";
  if (type === "video") return "video/mp4";
  return "application/octet-stream";
}

function extensionForMime(mimeType?: string) {
  if (!mimeType) return "";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("pdf")) return "pdf";
  return "";
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function findBase64(value: unknown): string | null {
  if (typeof value === "string") return looksLikeBase64(value) ? value : null;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["base64", "media", "file", "data", "result", "message"]) {
    const found = findBase64(record[key]);
    if (found) return found;
  }

  for (const item of Object.values(record)) {
    const found = findBase64(item);
    if (found) return found;
  }

  return null;
}

function findMimeType(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidate = record.mimetype ?? record.mimeType ?? record.contentType;
  if (typeof candidate === "string" && candidate.includes("/")) return candidate;

  for (const item of Object.values(record)) {
    const found = findMimeType(item);
    if (found) return found;
  }

  return null;
}

function looksLikeBase64(value: string) {
  const clean = stripDataUrlPrefix(value).trim();
  return clean.length > 80 && /^[A-Za-z0-9+/]+={0,2}$/.test(clean);
}
