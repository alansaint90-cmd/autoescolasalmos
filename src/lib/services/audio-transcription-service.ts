import { env } from "@/lib/env";
import type { NormalizedInboundMessage } from "@/lib/whatsapp/normalizer";

type AudioMedia = NonNullable<NormalizedInboundMessage["media"]>;

type TranscribeAudioOptions = {
  remoteJid?: string;
  messageId?: string;
  fromMe?: boolean;
};

export type AudioTranscriptionResult = {
  status: "transcribed" | "unavailable" | "error";
  text: string;
  reason?: string;
};

const openAiTranscriptionUrl = "https://api.openai.com/v1/audio/transcriptions";
const transcriptionModel = "whisper-1";

export async function transcribeInboundAudio(
  media: AudioMedia,
  options: TranscribeAudioOptions = {}
): Promise<AudioTranscriptionResult> {
  if (media.type !== "audio") {
    return { status: "unavailable", text: "", reason: "Midia recebida nao e audio." };
  }

  try {
    console.info("[audio-transcription] started", {
      messageId: options.messageId,
      hasBase64: Boolean(media.base64),
      hasUrl: Boolean(media.url),
      mimeType: media.mimeType
    });

    const audio = await getAudioBlob(media, options);
    if (!audio) {
      console.warn("[audio-transcription] audio unavailable", {
        messageId: options.messageId,
        reason: "missing_media_payload"
      });
      return {
        status: "unavailable",
        text: "",
        reason: "Audio recebido sem URL/base64 e a Evolution nao retornou o arquivo para transcricao."
      };
    }

    const formData = new FormData();
    formData.append("model", transcriptionModel);
    formData.append("file", audio.blob, audio.fileName);
    formData.append("language", "pt");
    formData.append("response_format", "json");

    const response = await fetch(openAiTranscriptionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn("[audio-transcription] openai failed", {
        messageId: options.messageId,
        status: response.status,
        body: body.slice(0, 240)
      });
      return {
        status: "error",
        text: "",
        reason: `OpenAI transcription failed: ${response.status} ${body.slice(0, 240)}`
      };
    }

    const data = await response.json().catch(() => null) as { text?: string } | null;
    const text = data?.text?.trim();
    if (!text) {
      console.warn("[audio-transcription] empty transcription", {
        messageId: options.messageId
      });
      return { status: "unavailable", text: "", reason: "OpenAI nao retornou texto para o audio." };
    }

    console.info("[audio-transcription] completed", {
      messageId: options.messageId,
      characters: text.length
    });

    return { status: "transcribed", text };
  } catch (error) {
    console.warn("[audio-transcription] failed", {
      messageId: options.messageId,
      error: error instanceof Error ? error.message : "Falha desconhecida ao transcrever audio."
    });
    return {
      status: "error",
      text: "",
      reason: error instanceof Error ? error.message : "Falha desconhecida ao transcrever audio."
    };
  }
}

async function getAudioBlob(media: AudioMedia, options: TranscribeAudioOptions) {
  if (media.base64) {
    const buffer = Buffer.from(stripDataUrlPrefix(media.base64), "base64");
    return {
      blob: new Blob([buffer], { type: media.mimeType || "audio/ogg" }),
      fileName: fileNameForMime(media.mimeType)
    };
  }

  if (options.messageId && options.remoteJid) {
    try {
      const evolutionAudio = await getAudioBlobFromEvolution(media, options);
      if (evolutionAudio) return evolutionAudio;
    } catch (error) {
      console.warn("[audio-transcription] evolution media fetch fallback to webhook url", {
        messageId: options.messageId,
        error: error instanceof Error ? error.message : "Falha desconhecida ao buscar audio na Evolution."
      });
      if (!media.url) throw error;
    }
  }

  if (!media.url) return null;

  const response = await fetch(media.url, {
    headers: {
      apikey: env.EVOLUTION_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar audio da Evolution: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? media.mimeType ?? "audio/ogg";
  const buffer = await response.arrayBuffer();
  console.info("[audio-transcription] webhook url media downloaded", {
    messageId: options.messageId,
    contentType,
    bytes: buffer.byteLength
  });

  return {
    blob: new Blob([buffer], { type: contentType }),
    fileName: fileNameForMime(contentType)
  };
}

async function getAudioBlobFromEvolution(media: AudioMedia, options: TranscribeAudioOptions) {
  if (!options.messageId || !options.remoteJid) return null;

  const url = new URL(`/chat/getBase64FromMediaMessage/${env.EVOLUTION_INSTANCE_NAME}`, env.EVOLUTION_API_URL);
  console.info("[audio-transcription] fetching media from evolution", {
    messageId: options.messageId,
    remoteJid: options.remoteJid,
    url: url.toString()
  });
  const payloads = [
    {
      message: {
        key: {
          id: options.messageId,
          remoteJid: options.remoteJid,
          fromMe: Boolean(options.fromMe)
        }
      },
      convertToMp4: false
    },
    {
      key: {
        id: options.messageId,
        remoteJid: options.remoteJid,
        fromMe: Boolean(options.fromMe)
      },
      convertToMp4: false
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
      lastError = `${response.status} ${body.slice(0, 200)}`;
      continue;
    }

    const data = parseJson(body);
    const base64 = findBase64(data);
    if (!base64) {
      lastError = "Resposta da Evolution sem base64 de midia.";
      continue;
    }

    const mimeType = findMimeType(data) ?? media.mimeType ?? "audio/ogg";
    const buffer = Buffer.from(stripDataUrlPrefix(base64), "base64");

    return {
      blob: new Blob([buffer], { type: mimeType }),
      fileName: fileNameForMime(mimeType)
    };
  }

  if (lastError) {
    throw new Error(`Falha ao obter audio pela Evolution: ${lastError}`);
  }

  return null;
}

function stripDataUrlPrefix(value: string) {
  const [, payload] = value.match(/^data:[^;]+;base64,(.+)$/i) ?? [];
  return payload ?? value;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function findBase64(value: unknown): string | null {
  if (typeof value === "string") {
    return looksLikeBase64(value) ? value : null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const direct = [
    record.base64,
    record.media,
    record.file,
    record.data,
    record.result,
    record.message
  ];

  for (const item of direct) {
    const found = findBase64(item);
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

function fileNameForMime(mimeType?: string | null) {
  if (mimeType?.includes("mpeg") || mimeType?.includes("mp3")) return "audio.mp3";
  if (mimeType?.includes("wav")) return "audio.wav";
  if (mimeType?.includes("webm")) return "audio.webm";
  if (mimeType?.includes("mp4")) return "audio.mp4";
  return "audio.ogg";
}
