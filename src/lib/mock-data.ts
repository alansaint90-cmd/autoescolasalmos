export type Temperature = "quente" | "morno" | "frio" | "urgente";
export type Stage =
  | "novo"
  | "ia"
  | "atendimento"
  | "followup"
  | "matricula_pendente"
  | "fechado"
  | "perdido";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  origin: string;
  temperature: Temperature;
  lastInteraction: string;
  responsible: string;
  avatar: string;
  stage: Stage;
  interest: "carro" | "moto" | "adicao" | "mudanca";
  notes?: string;
};

export const stages: Array<{ id: Stage; title: string; tone: string }> = [
  { id: "novo", title: "Novo Lead", tone: "blue" },
  { id: "ia", title: "IA Atendendo", tone: "violet" },
  { id: "atendimento", title: "Em Atendimento", tone: "cyan" },
  { id: "followup", title: "Follow-up", tone: "orange" },
  { id: "matricula_pendente", title: "Matricula Pendente", tone: "yellow" },
  { id: "fechado", title: "Fechado", tone: "green" },
  { id: "perdido", title: "Perdido", tone: "red" }
];

export const leads: Lead[] = [];

export const dashboardStats = {
  leadsHoje: 0,
  conversasAtivas: 0,
  matriculasFechadas: 0,
  taxaConversao: 0,
  iaAtendendo: 0,
  leadsQuentes: 0,
  tempoMedioResposta: "0s",
  vendasMes: "R$ 0"
};

export const leadsByOrigin: Array<{ label: string; value: number; percent: number }> = [];

export const campaignConversion: Array<{
  campaign: string;
  leads: number;
  enrollments: number;
  conversion: number;
}> = [];

export const sellerClosing: Array<{
  seller: string;
  closed: number;
  revenue: string;
  conversion: number;
}> = [];

export const funnelData: Array<{ etapa: string; value: number }> = [];

export const aiPerformance: Array<{ metric: string; value: number; detail: string }> = [];

export type Message = {
  id: string;
  from: "lead" | "ia" | "human";
  text: string;
  time: string;
  senderName?: string;
  senderRole?: string;
  media?: {
    type: "audio" | "image" | "video" | "document";
    sourceUrl?: string;
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
    caption?: string;
    transcription?: string;
    transcriptionStatus?: string;
    description?: string;
    descriptionStatus?: string;
    storageStatus?: string;
    durationSeconds?: number;
  };
};

export const conversations: Array<{
  lead: Lead;
  online: boolean;
  unread: number;
  preview: string;
  status: string;
  messages: Message[];
}> = [];
