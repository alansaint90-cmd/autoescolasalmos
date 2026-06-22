import type { EvolutionWebhookInput } from "@/lib/validators/evolution";

export type NormalizedInboundMessage = {
  externalChatId: string;
  externalMessageId?: string;
  phone: string;
  leadName?: string;
  avatarUrl?: string;
  text: string;
  messageType?: string;
  marketing?: {
    isAdLead: boolean;
    platform?: string;
    origin: string;
    campaign?: string;
    adSet?: string;
    adId?: string;
    adTitle?: string;
    creative?: string;
    sourceUrl?: string;
    referralText?: string;
    utm?: Record<string, string>;
  };
  media?: {
    type: "audio" | "image" | "video" | "document";
    fileName?: string;
    caption?: string;
    mimeType?: string;
    url?: string;
    base64?: string;
    durationSeconds?: number;
  };
  fromMe: boolean;
};

export function getIgnorableChatReason(remoteJid: string) {
  const jid = remoteJid.trim().toLowerCase();
  const numeric = jid.replace(/\D/g, "");

  if (!jid) return "jid_empty";
  if (jid === "status@broadcast") return "status_broadcast";
  if (jid.includes("@g.us")) return "group_message";
  if (jid.includes("@newsletter")) return "newsletter_message";
  if (jid.includes("@broadcast")) return "broadcast_message";
  if (numeric.startsWith("120363")) return "group_or_channel_id";

  const hasKnownIndividualSuffix = jid.includes("@s.whatsapp.net") || jid.includes("@c.us");
  const hasUnsupportedSuffix = jid.includes("@") && !hasKnownIndividualSuffix;
  if (hasUnsupportedSuffix) return "unsupported_chat_jid";

  if (numeric.length < 12 || numeric.length > 15) return "invalid_customer_phone";

  return null;
}

export function normalizeEvolutionMessage(input: EvolutionWebhookInput): NormalizedInboundMessage | null {
  if (getIgnorableChatReason(input.data.key.remoteJid)) {
    return null;
  }

  const extracted = extractMessage(input.data.message, input);
  const text = extracted.text;
  const marketing = extractMarketingAttribution(input, text);

  if (!text.trim()) {
    return null;
  }

  return {
    externalChatId: input.data.key.remoteJid,
    externalMessageId: input.data.key.id,
    phone: input.data.key.remoteJid.replace(/\D/g, ""),
    leadName: input.data.pushName,
    avatarUrl: input.data.profilePictureUrl ?? input.data.profilePicUrl ?? input.data.picture,
    text,
    messageType: input.data.messageType,
    marketing,
    media: extracted.media,
    fromMe: input.data.key.fromMe
  };
}

function extractMessage(message: unknown, input: EvolutionWebhookInput): Pick<NormalizedInboundMessage, "text" | "media"> {
  if (typeof message === "string") return { text: message };
  if (!isRecord(message)) {
    const fallbackText = getString(input.data.text)
      ?? getString(input.data.body)
      ?? getString(input.data.caption)
      ?? getString((input as unknown as Record<string, unknown>).message);

    return { text: fallbackText ?? "" };
  }

  const unwrapped = unwrapMessage(message);

  const conversation = unwrapped.conversation;
  if (typeof conversation === "string") return { text: conversation };

  const extended = unwrapped.extendedTextMessage;
  if (isRecord(extended) && typeof extended.text === "string") return { text: extended.text };

  const image = unwrapped.imageMessage;
  if (isRecord(image)) {
    const caption = getString(image.caption);
    return {
      text: caption || "[imagem recebida]",
      media: {
        type: "image",
        caption,
        mimeType: getString(image.mimetype) ?? getString(image.mimeType),
        url: getMediaUrl(image),
        base64: getMediaBase64(image)
      }
    };
  }

  const audio = unwrapped.audioMessage;
  if (isRecord(audio)) {
    return {
      text: "[audio recebido]",
      media: {
        type: "audio",
        mimeType: getString(audio.mimetype) ?? getString(audio.mimeType),
        url: getMediaUrl(audio),
        base64: getMediaBase64(audio),
        durationSeconds: getNumber(audio.seconds) ?? getNumber(audio.duration)
      }
    };
  }

  const video = unwrapped.videoMessage;
  if (isRecord(video)) {
    const caption = getString(video.caption);
    return {
      text: caption || "[video recebido]",
      media: {
        type: "video",
        caption,
        mimeType: getString(video.mimetype) ?? getString(video.mimeType),
        url: getMediaUrl(video),
        base64: getMediaBase64(video),
        durationSeconds: getNumber(video.seconds) ?? getNumber(video.duration)
      }
    };
  }

  const document = unwrapped.documentMessage;
  if (isRecord(document)) {
    const fileName = getString(document.fileName);
    const caption = getString(document.caption);
    return {
      text: caption || (fileName ? `[documento recebido: ${fileName}]` : "[documento recebido]"),
      media: {
        type: "document",
        fileName,
        caption,
        mimeType: getString(document.mimetype) ?? getString(document.mimeType),
        url: getMediaUrl(document),
        base64: getMediaBase64(document)
      }
    };
  }

  return { text: "" };
}

function unwrapMessage(message: Record<string, unknown>) {
  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "documentWithCaptionMessage"
  ];

  let current = message;
  for (const wrapper of wrappers) {
    const wrapped = current[wrapper];
    if (isRecord(wrapped) && isRecord(wrapped.message)) {
      current = wrapped.message;
    }
  }

  return current;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function getMediaUrl(message: Record<string, unknown>) {
  return getString(message.url)
    ?? getString(message.mediaUrl)
    ?? getString(message.fileUrl)
    ?? getString(message.downloadUrl);
}

function getMediaBase64(message: Record<string, unknown>) {
  return getString(message.base64)
    ?? getString(message.mediaBase64)
    ?? getString(message.fileBase64);
}

function extractMarketingAttribution(input: EvolutionWebhookInput, text: string): NormalizedInboundMessage["marketing"] {
  const records = collectRecords(input as unknown as Record<string, unknown>);
  const context = records.find((record) => isLikelyAdRecord(record));
  const textSignals = detectAdTextSignals(text);
  const platform = getMarketingPlatform(records, text);
  const adTitle = getFirstString(records, ["title", "headline", "body", "sourceName", "mediaTitle"]);
  const campaign = getFirstString(records, ["campaign", "campaignName", "utm_campaign", "utmCampaign"]);
  const adSet = getFirstString(records, ["adSet", "adset", "adsetName", "ad_set", "adSetName", "utm_adset"]);
  const adId = getFirstString(records, ["adId", "ad_id", "sourceId", "ctwaClid", "clid"]);
  const sourceUrl = getFirstString(records, ["sourceUrl", "url", "thumbnailUrl", "mediaUrl"]);
  const referralText = getFirstString(records, ["referralBody", "body", "description", "text"]);
  const creative = getFirstString(records, ["creative", "creativeName", "creative_id", "asset", "mediaTitle"]);
  const utm = extractUtm(records, text);
  const isAdLead = Boolean(context || textSignals.isAdLead || campaign || adId);

  return {
    isAdLead,
    platform,
    origin: isAdLead ? normalizeMarketingOrigin(platform, text) : "WhatsApp",
    campaign,
    adSet,
    adId,
    adTitle,
    creative,
    sourceUrl,
    referralText,
    utm
  };
}

function collectRecords(value: unknown, records: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 8 || value === null || typeof value !== "object") return records;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRecords(item, records, depth + 1);
    }
    return records;
  }

  const record = value as Record<string, unknown>;
  records.push(record);

  for (const child of Object.values(record)) {
    collectRecords(child, records, depth + 1);
  }

  return records;
}

function isLikelyAdRecord(record: Record<string, unknown>) {
  const keys = Object.keys(record).map((key) => key.toLowerCase());
  const keyText = keys.join(" ");
  const valuesText = Object.values(record)
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    keyText.includes("externaladreply")
    || keyText.includes("adid")
    || keyText.includes("ad_id")
    || keyText.includes("ctwa")
    || keyText.includes("referral")
    || keyText.includes("campaign")
    || valuesText.includes("instagram.com/p/")
    || valuesText.includes("facebook.com")
    || valuesText.includes("fb.me")
    || valuesText.includes("anuncio")
    || valuesText.includes("anúncio")
  );
}

function detectAdTextSignals(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    isAdLead: isPaidTrafficEntryText(normalized)
  };
}

function isPaidTrafficEntryText(normalizedText: string) {
  const acceptedMessages = [
    "tenho interesse gostaria de mais informacoes por favor",
    "ola tenho interesse gostaria de mais informacoes por favor",
    "tenho interesse e gostaria de mais informacoes por favor",
    "ola tenho interesse e gostaria de mais informacoes por favor",
    "tenho interesse e queria mais informacoes por favor",
    "ola tenho interesse e queria mais informacoes por favor"
  ];

  return acceptedMessages.includes(normalizedText);
}

function getMarketingPlatform(records: Record<string, unknown>[], text: string) {
  const platform = getFirstString(records, ["platform", "sourceType", "source", "mediaType"]);
  const combined = `${platform ?? ""} ${text}`.toLowerCase();

  if (combined.includes("instagram")) return "Instagram";
  if (combined.includes("facebook") || combined.includes("fb.me")) return "Facebook";
  if (combined.includes("meta") || combined.includes("ctwa")) return "Meta";
  if (combined.includes("google")) return "Google";
  return platform;
}

function normalizeMarketingOrigin(platform: string | undefined, text: string) {
  const normalized = text.toLowerCase();
  if (platform === "Instagram" || normalized.includes("instagram.com")) return "Instagram Ads";
  if (platform === "Facebook" || normalized.includes("facebook.com") || normalized.includes("fb.me")) return "Facebook Ads";
  if (platform === "Google") return "Google Ads";
  return "Meta Ads";
}

function getFirstString(records: Record<string, unknown>[], keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (wanted.has(key.toLowerCase())) {
        const stringValue = getString(value);
        if (stringValue) return stringValue;
      }
    }
  }

  return undefined;
}

function extractUtm(records: Record<string, unknown>[], text: string) {
  const utm: Record<string, string> = {};
  const directKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  for (const key of directKeys) {
    const value = getFirstString(records, [key, key.replace("utm_", "utm")]);
    if (value) utm[key] = value;
  }

  const urls = [
    text,
    ...records.flatMap((record) => Object.values(record).filter((value): value is string => typeof value === "string"))
  ];

  for (const value of urls) {
    const matches = value.match(/https?:\/\/[^\s]+/g) ?? [];
    for (const rawUrl of matches) {
      try {
        const url = new URL(rawUrl);
        for (const key of directKeys) {
          const param = url.searchParams.get(key);
          if (param && !utm[key]) utm[key] = param;
        }
      } catch {
        // Ignore malformed URLs coming from WhatsApp previews.
      }
    }
  }

  return Object.keys(utm).length > 0 ? utm : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
