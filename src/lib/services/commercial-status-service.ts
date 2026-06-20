import type { NormalizedInboundMessage } from "@/lib/whatsapp/normalizer";

export type CommercialStatus =
  | "venda"
  | "nao_venda"
  | "pendente"
  | "em_atendimento"
  | "aguardando_comprovante"
  | "aguardando_validacao_pagamento"
  | "atendimento_humano_necessario";

export type CommercialSignal = {
  status: CommercialStatus;
  pipelineStage?: "ia" | "atendimento" | "followup" | "matricula_pendente" | "fechado" | "perdido";
  temperature?: "urgente" | "quente" | "morno" | "frio";
  shouldNotify: boolean;
  notificationType?: "payment_receipt" | "purchase_intent" | "pending_lead" | "human_required" | "human_requested";
  reason: string;
};

export function classifyCommercialSignal(input: NormalizedInboundMessage, hasPaymentReceipt = false): CommercialSignal {
  const text = normalize(input.text);
  const hasAny = (terms: string[]) => terms.some((term) => text.includes(term));

  const askedHuman = hasAny([
    "atendente",
    "humano",
    "falar com alguem",
    "falar com uma pessoa",
    "secretaria",
    "recepcao",
    "ligacao"
  ]);
  const noInterest = hasAny(["nao tenho interesse", "sem interesse", "nao quero", "desisti", "deixa pra la", "muito caro"]);
  const sentPayment = hasPaymentReceipt || hasAny(["comprovante", "paguei", "pagamento feito", "pix feito", "enviei o pix"]);
  const discountRequest = hasAny([
    "desconto",
    "tem desconto",
    "da desconto",
    "consegue desconto",
    "consegue melhorar",
    "melhor valor",
    "valor melhor",
    "condicao especial",
    "abatimento",
    "negociar",
    "negociacao"
  ]);
  const purchaseIntent = hasAny([
    "quero matricular",
    "quero fechar",
    "vou fechar",
    "posso fazer a matricula",
    "fazer a matricula",
    "iniciar o processo",
    "comecar o processo",
    "como pago",
    "forma de pagamento",
    "formas de pagamento",
    "parcelamento",
    "parcelar",
    "chave pix",
    "manda o pix",
    "manda a chave",
    "fazer inscricao",
    "fazer a inscricao",
    "garantir minha vaga",
    "vou presencial",
    "vou ai",
    "vou na auto escola",
    "vou na cfc"
  ]);
  const sensitive = hasAny(["reclamacao", "problema", "cancelar", "reembolso", "documento pendente", "bloqueado"]);

  if (sentPayment) {
    return {
      status: "aguardando_validacao_pagamento",
      pipelineStage: "matricula_pendente",
      temperature: "urgente",
      shouldNotify: true,
      notificationType: "payment_receipt",
      reason: "Cliente enviou ou mencionou comprovante/pagamento. Precisa validacao humana."
    };
  }

  if (askedHuman || sensitive || discountRequest) {
    return {
      status: "atendimento_humano_necessario",
      pipelineStage: "atendimento",
      temperature: "quente",
      shouldNotify: true,
      notificationType: askedHuman ? "human_requested" : "human_required",
      reason: askedHuman
        ? "Cliente pediu atendimento humano."
        : discountRequest
          ? "Cliente pediu desconto ou negociacao especial. Atendimento humano deve assumir."
          : "IA detectou tema sensivel para atendimento humano."
    };
  }

  if (purchaseIntent) {
    return {
      status: "aguardando_comprovante",
      pipelineStage: "matricula_pendente",
      temperature: "urgente",
      shouldNotify: true,
      notificationType: "purchase_intent",
      reason: "Cliente demonstrou intencao clara de compra ou pediu forma de pagamento."
    };
  }

  if (noInterest) {
    return {
      status: "nao_venda",
      pipelineStage: "perdido",
      temperature: "frio",
      shouldNotify: false,
      reason: "Cliente indicou falta de interesse."
    };
  }

  return {
    status: "em_atendimento",
    shouldNotify: false,
    reason: "Conversa comercial em andamento."
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
