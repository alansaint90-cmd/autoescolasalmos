import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db/client";
import { paymentReceipts } from "@/lib/db/schema";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { env } from "@/lib/env";
import type { NormalizedInboundMessage } from "@/lib/whatsapp/normalizer";

type AnalyzePaymentReceiptInput = {
  leadId: string;
  conversationId: string;
  messageId: string;
  inbound: NormalizedInboundMessage;
};

type ReceiptExtraction = {
  detected: boolean;
  amountText?: string;
  paidAtText?: string;
  payerName?: string;
  receiverName?: string;
  bankName?: string;
  transactionId?: string;
  rawText?: string;
  confidence?: "baixa" | "media" | "alta";
  reason?: string;
};

export function isPotentialPixReceipt(input: NormalizedInboundMessage) {
  const media = input.media;
  if (!media || (media.type !== "image" && media.type !== "document")) return false;

  const combined = normalize([
    input.text,
    media.caption,
    media.fileName,
    media.mimeType
  ].filter(Boolean).join(" "));

  if (media.type === "image") return true;
  if (combined.includes("pdf") || media.mimeType?.toLowerCase().includes("pdf")) return true;
  return hasPixReceiptKeyword(combined);
}

export async function analyzeAndSavePaymentReceipt(input: AnalyzePaymentReceiptInput) {
  const extracted = await extractReceiptData(input.inbound);
  const media = input.inbound.media;

  const [receipt] = await db
    .insert(paymentReceipts)
    .values({
      lead_id: input.leadId,
      conversation_id: input.conversationId,
      message_id: input.messageId,
      status: "aguardando_validacao",
      detected: extracted.detected,
      file_url: media?.url,
      file_name: media?.fileName,
      mime_type: media?.mimeType,
      amount_text: extracted.amountText,
      paid_at_text: extracted.paidAtText,
      payer_name: extracted.payerName,
      receiver_name: extracted.receiverName,
      bank_name: extracted.bankName,
      transaction_id: extracted.transactionId,
      raw_text: extracted.rawText,
      metadata: {
        confidence: extracted.confidence,
        reason: extracted.reason,
        source: "evolution_media",
        mediaType: media?.type
      },
      modified_by: SYSTEM_USER_ID
    })
    .returning();

  return { receipt, extracted };
}

async function extractReceiptData(input: NormalizedInboundMessage): Promise<ReceiptExtraction> {
  const fallback = extractReceiptDataFromText([
    input.text,
    input.media?.caption,
    input.media?.fileName
  ].filter(Boolean).join("\n"));

  if (!input.media || !env.OPENAI_API_KEY) {
    return fallback;
  }

  const mediaRef = buildMediaReference(input.media);
  if (!mediaRef) return fallback;

  try {
    const result = await generateText({
      model: openai(env.OPENAI_MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Analise o arquivo recebido no WhatsApp e identifique se parece um comprovante PIX.",
                "Retorne somente JSON valido com as chaves:",
                "detected, amountText, paidAtText, payerName, receiverName, bankName, transactionId, rawText, confidence, reason.",
                "Nao confirme pagamento. Se nao houver informacao clara, deixe os campos em branco e confidence baixa."
              ].join(" ")
            },
            input.media.type === "image"
              ? { type: "image", image: mediaRef }
              : { type: "text", text: `Documento recebido para analise: ${input.media.fileName ?? input.media.mimeType ?? "arquivo"}. Texto/caption: ${input.text}` }
          ] as never
        }
      ]
    });

    const parsed = parseJsonExtraction(result.text);
    return {
      ...fallback,
      ...parsed,
      detected: Boolean(parsed.detected || fallback.detected),
      rawText: parsed.rawText || fallback.rawText || result.text.slice(0, 1200),
      reason: parsed.reason || fallback.reason
    };
  } catch (error) {
    console.warn("[payment-receipt] openai receipt analysis failed", error);
    return fallback;
  }
}

function buildMediaReference(media: NonNullable<NormalizedInboundMessage["media"]>) {
  if (media.base64) {
    const mimeType = media.mimeType || "image/jpeg";
    return `data:${mimeType};base64,${media.base64}`;
  }

  return media.url;
}

function extractReceiptDataFromText(text: string): ReceiptExtraction {
  const normalized = normalize(text);
  const detected = hasPixReceiptKeyword(normalized);
  const amount = text.match(/R\$\s*[\d.]+,\d{2}/i)?.[0]
    ?? text.match(/(?:valor|total)\D{0,20}([\d.]+,\d{2})/i)?.[1];
  const transactionId = text.match(/(?:id|e2e|autenticacao|transacao|codigo)\D{0,20}([a-z0-9.-]{8,})/i)?.[1];
  const paidAt = text.match(/\b\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?\b/)?.[0];

  return {
    detected,
    amountText: amount,
    paidAtText: paidAt,
    transactionId,
    rawText: text.slice(0, 1200),
    confidence: detected ? "media" : "baixa",
    reason: detected ? "Palavras-chave de PIX/comprovante detectadas no texto ou nome do arquivo." : "Arquivo recebido sem texto suficiente para confirmar comprovante."
  };
}

function parseJsonExtraction(text: string): Partial<ReceiptExtraction> {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      detected: Boolean(parsed.detected),
      amountText: asString(parsed.amountText),
      paidAtText: asString(parsed.paidAtText),
      payerName: asString(parsed.payerName),
      receiverName: asString(parsed.receiverName),
      bankName: asString(parsed.bankName),
      transactionId: asString(parsed.transactionId),
      rawText: asString(parsed.rawText),
      confidence: asString(parsed.confidence) as ReceiptExtraction["confidence"],
      reason: asString(parsed.reason)
    };
  } catch {
    return {};
  }
}

function hasPixReceiptKeyword(text: string) {
  return ["pix", "comprovante", "pagamento", "transferencia", "autenticacao", "e2e"].some((term) => text.includes(term));
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
