import { env } from "@/lib/env";

export type ImageDescriptionResult = {
  status: "described" | "unavailable" | "error";
  text: string;
  reason?: string;
};

export async function describeInboundImage(input: {
  dataUrl?: string;
  caption?: string;
  messageId?: string;
}): Promise<ImageDescriptionResult> {
  if (!input.dataUrl) {
    return { status: "unavailable", text: "", reason: "Imagem sem base64/dataUrl para analise." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.2,
        max_tokens: 140,
        messages: [
          {
            role: "system",
            content: "Descreva objetivamente imagens recebidas por WhatsApp para contexto de atendimento comercial de autoescola. Nao invente dados ilegíveis."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: input.caption
                  ? `Legenda do cliente: ${input.caption}. Descreva a imagem em ate 2 frases.`
                  : "Descreva a imagem em ate 2 frases."
              },
              {
                type: "image_url",
                image_url: { url: input.dataUrl }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        status: "error",
        text: "",
        reason: `OpenAI Vision failed: ${response.status} ${body.slice(0, 220)}`
      };
    }

    const data = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { status: "unavailable", text: "", reason: "OpenAI nao retornou descricao para a imagem." };
    }

    return { status: "described", text };
  } catch (error) {
    return {
      status: "error",
      text: "",
      reason: error instanceof Error ? error.message : "Falha desconhecida ao descrever imagem."
    };
  }
}
