import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { sendWhatsAppText } from "@/lib/services/evolution-api";
import { assertPermission } from "@/lib/services/permission-service";

const fallbackRecipients = ["5571988480222", "5571996729683"];
const fallbackSupportRecipient = "5571988345088";

type NotificationRecipient = {
  label: string;
  phone: string;
  type: "internal" | "support";
};

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Sessao invalida") || message.includes("expirada")) return 401;
  if (message.includes("Sem permissao")) return 403;

  return 500;
}

export async function GET() {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");

    return NextResponse.json({ recipients: getRecipients() });
  } catch (error) {
    console.error("[notification-test] failed to list recipients", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel listar os numeros de teste." },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");

    const body = (await request.json().catch(() => ({}))) as { phone?: string };
    const allRecipients = getRecipients();
    const requestedPhone = body.phone?.replace(/\D/g, "");
    const recipients = requestedPhone
      ? allRecipients.filter((recipient) => recipient.phone === requestedPhone)
      : allRecipients;

    if (recipients.length === 0) {
      return NextResponse.json({ error: "Nenhum numero de notificacao encontrado para o teste." }, { status: 400 });
    }

    const text = [
      "[TESTE AUTO PRO IA]",
      "",
      "Mensagem de teste enviada pelo painel IA Comercial.",
      "Se voce recebeu esta mensagem, o canal de notificacao do WhatsApp esta funcionando."
    ].join("\n");

    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        await sendWhatsAppText({ phone: recipient.phone, text });
        return recipient.phone;
      })
    );

    const sent = results
      .map((result, index) => ({ result, phone: recipients[index]?.phone ?? "" }))
      .filter((item): item is { result: PromiseFulfilledResult<string>; phone: string } => item.result.status === "fulfilled")
      .map((item) => item.phone);
    const failed = results
      .map((result, index) => ({ result, phone: recipients[index]?.phone ?? "" }))
      .filter((item): item is { result: PromiseRejectedResult; phone: string } => item.result.status === "rejected")
      .map((item) => ({
        phone: item.phone,
        error: item.result.reason instanceof Error ? item.result.reason.message : "Falha desconhecida"
      }));

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("[notification-test] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel testar as notificacoes." },
      { status: errorStatus(error) }
    );
  }
}

function getRecipients(): NotificationRecipient[] {
  const configured = (env.NOTIFICATION_WHATSAPP_NUMBERS ?? "")
    .split(",")
    .map((phone) => phone.replace(/\D/g, ""))
    .filter((phone) => phone.length >= 12);

  const internalPhones = Array.from(new Set(configured.length > 0 ? configured : fallbackRecipients));
  const supportPhone = (env.SUPPORT_WHATSAPP_NUMBER ?? fallbackSupportRecipient).replace(/\D/g, "");
  const recipients: NotificationRecipient[] = internalPhones.map((phone, index) => ({
    label: index === 0 ? "Notificacao interna 1" : `Notificacao interna ${index + 1}`,
    phone,
    type: "internal"
  }));

  if (supportPhone && supportPhone.length >= 12 && !recipients.some((recipient) => recipient.phone === supportPhone)) {
    recipients.push({
      label: "Suporte de erro",
      phone: supportPhone,
      type: "support"
    });
  }

  return recipients;
}
