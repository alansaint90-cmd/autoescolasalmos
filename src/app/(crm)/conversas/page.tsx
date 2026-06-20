"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import {
  Archive,
  Ban,
  Bot,
  Camera,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gauge,
  ImageIcon,
  FileText,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  Mic,
  Music2,
  Pencil,
  Pause,
  Pin,
  Phone,
  Plus,
  Search,
  Send,
  Smile,
  Star,
  Sparkles,
  Target,
  Thermometer,
  Trash2,
  VolumeX,
  UserCheck,
  Video,
  WandSparkles,
  X,
  Zap
} from "lucide-react";
import type { ChangeEvent } from "react";
import { Topbar } from "@/components/topbar";
import type { conversations } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type QuickReply = {
  id: string;
  name: string;
  message: string;
  attachment?: QuickReplyAttachment;
};

type InboxView = "all" | "favorites" | "locked" | "archived" | "muted";
type PreviewTooltip = { text: string; top: number; left: number } | null;
const inboxListsStorageKey = "auto-pro-ia:inbox-lists";
const inboxStateStorageKey = "auto-pro-ia:inbox-state";

type QuickReplyAttachment = {
  name: string;
  type: "audio" | "image" | "video";
  dataUrl: string;
};

type Conversation = (typeof conversations)[number] & {
  id?: string;
  archived?: boolean;
  muted?: boolean;
  pinned?: boolean;
  blocked?: boolean;
  cleared?: boolean;
  status: "ai" | "human" | "paused" | "closed";
};

type CurrentUser = {
  name: string;
  role: string;
};

const roleLabelMap: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  gerente: "Gerente",
  atendente: "Atendente",
  operador: "Operador",
  visualizador: "Visualizador",
  ia: "IA",
  sdr: "Atendente",
  closer: "Atendente",
  bot: "IA"
};

function formatRoleLabel(role?: string) {
  if (!role) return "";
  return roleLabelMap[role] ?? role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHumanSender(message: Conversation["messages"][number], currentUser: CurrentUser | null) {
  const name = message.senderName?.trim() || currentUser?.name?.trim() || "Atendente";
  const role = formatRoleLabel(message.senderRole || currentUser?.role);
  return role ? `${name} - ${role}` : name;
}

function formatAiSender(agentName: string) {
  const name = agentName.trim() || "Camila";
  return `${name} IA`;
}

type KanbanStoredLead = {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  origin: string;
  status?: string;
  temperature?: string;
  sentiment?: string;
  lastMessage?: string;
  lastInteraction?: string;
  responsible?: string;
  notes?: string;
};

const quickReplyStorageKey = "auto-pro-ia:quick-replies";

const temperatureEmoji: Record<Conversation["lead"]["temperature"], string> = {
  quente: "🔥",
  morno: "🌤️",
  frio: "❄️",
  urgente: "🚨"
};

const temperatureClasses: Record<Conversation["lead"]["temperature"], string> = {
  quente: "border-[#22C55E]/30 bg-[#22C55E]/12 text-[#22C55E]",
  morno: "border-[#FACC15]/30 bg-[#FACC15]/12 text-[#FACC15]",
  frio: "border-[#0B5FA5]/35 bg-[#0B5FA5]/16 text-blue-100",
  urgente: "border-[#FACC15]/45 bg-[#FACC15]/16 text-[#FACC15]"
};

const temperatureBar: Record<Conversation["lead"]["temperature"], { width: string; gradient: string; label: string }> = {
  frio: { width: "32%", gradient: "from-[#0B5FA5] to-blue-300", label: "Baixo interesse" },
  morno: { width: "58%", gradient: "from-[#FACC15] to-[#EAB308]", label: "Interesse em evolucao" },
  quente: { width: "82%", gradient: "from-[#22C55E] to-emerald-300", label: "Alta chance de conversao" },
  urgente: { width: "96%", gradient: "from-[#FACC15] to-[#22C55E]", label: "Atencao imediata" }
};

type LeadSentiment = "positivo" | "neutro" | "duvida" | "negativo";

const sentimentEmoji: Record<LeadSentiment, string> = {
  positivo: "😊",
  neutro: "😐",
  duvida: "🤔",
  negativo: "😟"
};

const sentimentClasses: Record<LeadSentiment, string> = {
  positivo: "border-[#22C55E]/30 bg-[#22C55E]/12 text-[#22C55E]",
  neutro: "border-slate-400/30 bg-slate-400/[0.12] text-slate-200",
  duvida: "border-[#0B5FA5]/35 bg-[#0B5FA5]/16 text-blue-100",
  negativo: "border-[#FACC15]/40 bg-[#FACC15]/14 text-[#FACC15]"
};

const sentimentBar: Record<LeadSentiment, { width: string; gradient: string; label: string }> = {
  positivo: { width: "88%", gradient: "from-[#22C55E] to-emerald-300", label: "Animado para avancar" },
  neutro: { width: "54%", gradient: "from-slate-400 to-slate-200", label: "Aguardando estimulo" },
  duvida: { width: "42%", gradient: "from-[#0B5FA5] to-blue-300", label: "Precisa de clareza" },
  negativo: { width: "22%", gradient: "from-[#FACC15] to-[#EAB308]", label: "Risco de perda" }
};

const originEmoji: Record<string, string> = {
  "Meta Ads": "🎯",
  "Google Ads": "🔎",
  WhatsApp: "🟢",
  Instagram: "📸",
  Indicacao: "🤝",
  Site: "🌐"
};

const stageLabels: Partial<Record<Conversation["lead"]["stage"], string>> = {
  novo: "Novo lead",
  ia: "IA atendendo",
  atendimento: "Em atendimento",
  matricula_pendente: "Matricula pendente",
  followup: "Follow up",
  fechado: "Fechado",
  perdido: "Sem Retorno"
};

const stageEmoji: Partial<Record<Conversation["lead"]["stage"], string>> = {
  novo: "✨",
  ia: "🤖",
  atendimento: "💬",
  matricula_pendente: "📋",
  followup: "⏱️",
  fechado: "🏁",
  perdido: "📌"
};

const closingChanceByTemperature: Record<Conversation["lead"]["temperature"], number> = {
  quente: 82,
  morno: 57,
  frio: 31,
  urgente: 91
};

const defaultAiSuggestionHint = "Clique para a IA ler a conversa e criar uma sugestao contextual para revisar antes de enviar.";

const operationalTimeline = [
  { title: "IA qualificou o interesse", detail: "CNH B, periodo noturno", time: "agora", icon: Bot },
  { title: "Cliente pediu valores", detail: "Comparando formas de pagamento", time: "8 min", icon: MessageSquareText },
  { title: "Proxima acao recomendada", detail: "Enviar proposta e sugerir visita", time: "15 min", icon: Target }
];

const defaultQuickReplies: QuickReply[] = [
  {
    id: "valores",
    name: "Valores",
    message: "Claro. Vou te passar as opcoes de valores e formas de pagamento para sua CNH. Voce pretende fazer categoria A, B ou AB?"
  },
  {
    id: "agendar-visita",
    name: "Agendar visita",
    message: "Podemos agendar uma visita na autoescola para voce conhecer a estrutura e tirar suas duvidas. Qual melhor horario para voce?"
  },
  {
    id: "endereco",
    name: "Endereco",
    message: "Nosso endereco e Av. Paulista, 1000. Posso te enviar a localizacao e verificar o melhor horario para atendimento."
  },
  {
    id: "confirmar-matricula",
    name: "Confirmar matricula",
    message: "Perfeito. Para confirmar sua matricula, preciso validar seus dados e a categoria desejada. Podemos seguir agora?"
  }
];

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeTemperature(value?: string): Conversation["lead"]["temperature"] {
  return value === "morno" || value === "frio" || value === "urgente" ? value : "quente";
}

function normalizeSentiment(value?: string): LeadSentiment {
  return value === "positivo" || value === "duvida" || value === "negativo" ? value : "neutro";
}

function attachmentTypeFromMime(mimeType: string): QuickReplyAttachment["type"] | null {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function attachmentLabel(type: QuickReplyAttachment["type"]) {
  if (type === "audio") return "Audio";
  if (type === "image") return "Imagem";
  return "Video";
}

function AttachmentIcon({ type, className }: { type: QuickReplyAttachment["type"]; className?: string }) {
  if (type === "audio") return <Music2 className={className} />;
  if (type === "image") return <ImageIcon className={className} />;
  return <Video className={className} />;
}

function messageMediaSource(message: Conversation["messages"][number]) {
  return message.media?.dataUrl || message.media?.sourceUrl || "";
}

function messageTextForDisplay(message: Conversation["messages"][number]) {
  const text = message.text.trim();
  if (!message.media) return text;

  if (message.media.type === "image") {
    const caption = message.media.caption?.trim() || "";
    const description = message.media.description?.trim() || "";

    if (/^\[imagem recebida\]$/i.test(text)) return caption;
    if (/^imagem recebida:/i.test(text)) return caption;
    if (description && text.includes(description)) return caption;
  }
  if (message.media.type === "video" && /^\[video recebido\]$/i.test(text)) {
    return message.media.caption || "";
  }
  if (message.media.type === "document" && /^\[documento recebido/i.test(text)) return "";
  if (message.media.type === "audio") {
    return message.media.transcription || text.replace(/^audio transcrito do cliente:\s*/i, "");
  }

  return text;
}

function formatMediaDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function ChatMediaAttachment({ message }: { message: Conversation["messages"][number] }) {
  const media = message.media;
  if (!media) return null;

  const source = messageMediaSource(message);
  const fileName = media.fileName || (
    media.type === "audio" ? "audio recebido" :
    media.type === "image" ? "imagem recebida" :
    media.type === "video" ? "video recebido" :
    "documento recebido"
  );

  if (media.type === "image") {
    return (
      <a
        href={source || undefined}
        target="_blank"
        rel="noreferrer"
        className="mb-3 block overflow-hidden rounded-xl border border-white/10 bg-black/20"
      >
        {source ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source} alt={fileName} className="max-h-72 w-full object-cover" />
        ) : (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <ImageIcon className="size-4 text-primary" />
            Imagem recebida sem arquivo disponivel.
          </div>
        )}
      </a>
    );
  }

  if (media.type === "audio") {
    return (
      <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
          <Music2 className="size-4" />
          Audio do cliente
          {media.durationSeconds ? (
            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {formatMediaDuration(media.durationSeconds)}
            </span>
          ) : null}
        </div>
        {source ? (
          <audio controls preload="metadata" src={source} className="w-full" />
        ) : (
          <p className="text-xs text-muted-foreground">Audio recebido, mas o arquivo original nao esta disponivel.</p>
        )}
      </div>
    );
  }

  if (media.type === "video") {
    return (
      <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
        {source ? (
          <video controls preload="metadata" src={source} className="max-h-80 w-full bg-black" />
        ) : (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Video className="size-4 text-primary" />
            Video recebido sem arquivo disponivel.
          </div>
        )}
      </div>
    );
  }

  return (
    <a
      href={source || undefined}
      target="_blank"
      rel="noreferrer"
      className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs font-bold text-foreground transition hover:border-primary/40"
    >
      <span className="flex items-center gap-2">
        <FileText className="size-4 text-primary" />
        {fileName}
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {source ? "Abrir" : "Indisponivel"}
      </span>
    </a>
  );
}

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ConversationInboxMenu({
  onArchive,
  onBlock,
  onClear,
  onDelete,
  onMute,
  onPin,
  isArchived,
  isBlocked,
  isMuted,
  isPinned,
  onClose
}: {
  onArchive: () => void;
  onBlock: () => void;
  onClear: () => void;
  onDelete: () => void;
  onMute: () => void;
  onPin: () => void;
  isArchived: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  isPinned: boolean;
  onClose: () => void;
}) {
  const actions = [
    { label: isArchived ? "Desarquivar conversa" : "Arquivar conversa", icon: Archive, action: onArchive },
    { label: isMuted ? "Ativar notificacoes" : "Silenciar notificacoes", icon: VolumeX, action: onMute },
    { label: isPinned ? "Desfixar conversa" : "Fixar conversa", icon: Pin, action: onPin },
    { label: "Marcar como nao lida", icon: MessageSquareText, action: onClose },
    { label: "Adicionar aos Favoritos", icon: Star, action: onClose },
    { label: "Adicionar a lista", icon: Plus, action: onClose },
    { label: isBlocked ? "Desbloquear" : "Bloquear", icon: Ban, action: onBlock, danger: true },
    { label: "Limpar conversa", icon: X, action: onClear },
    { label: "Apagar conversa", icon: Trash2, action: onDelete, danger: true }
  ];

  return (
    <div className="absolute right-2 top-9 z-[90] w-60 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1120]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl">
      {actions.map((item, index) => {
        const Icon = item.icon;
        const separated = index === 6;

        return (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition hover:bg-white/[0.06]",
              separated && "mt-1 border-t border-white/10 pt-3",
              item.danger ? "text-red-200 hover:bg-red-500/10" : "text-slate-100"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function LeadInitialAvatar({
  name,
  avatar,
  temperature,
  size = "md",
  neutral = false
}: {
  name: string;
  avatar?: string;
  temperature: Conversation["lead"]["temperature"];
  size?: "sm" | "md" | "lg" | "xl";
  neutral?: boolean;
}) {
  const displayAvatar = avatar && !avatar.includes("api.dicebear.com/7.x/initials") ? avatar : undefined;
  const sizes = {
    sm: "size-9 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
    xl: "size-14 text-lg"
  };

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-mono font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(0,0,0,0.24)]",
        displayAvatar ? "border-white/12 bg-[#111827]" : "border-[#FACC15]/55 bg-[linear-gradient(135deg,#FACC15,#EAB308)] text-[#0B1120] shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_18px_rgba(250,204,21,0.16),0_10px_24px_rgba(0,0,0,0.24)]",
        sizes[size]
      )}
      aria-hidden="true"
    >
      {displayAvatar ? (
        <img src={displayAvatar} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="relative z-10">{initialsFromName(name)}</span>
      )}
    </span>
  );
}

function normalizeStage(value?: string): Conversation["lead"]["stage"] {
  if (value === "interessado" || value === "negociacao" || value === "interessado_followup") {
    return "followup";
  }

  if (value === "qualificado" || value === "orcamento" || value === "atendimento") {
    return "atendimento";
  }

  if (value === "ia" || value === "followup" || value === "perdido" || value === "matricula_pendente" || value === "fechado") {
    return value;
  }

  if (value === "matricula_realizada") {
    return "fechado";
  }

  return "novo";
}

function getLeadSentiment(conversation: Conversation): LeadSentiment {
  const leadWithSentiment = conversation.lead as Conversation["lead"] & { sentiment?: string };
  return normalizeSentiment(leadWithSentiment.sentiment);
}

function isPersistedMessageId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createConversationFromKanbanLead(lead: KanbanStoredLead): Conversation {
  const preview = lead.lastMessage?.trim() || lead.notes?.trim() || "Lead criado no funil Kanban.";

  return {
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      origin: lead.origin,
      temperature: normalizeTemperature(lead.temperature),
      lastInteraction: lead.lastInteraction || "agora",
      responsible: lead.responsible || "Equipe comercial",
      avatar: lead.avatar,
      stage: normalizeStage(lead.status),
      interest: "carro",
      notes: lead.notes,
      sentiment: normalizeSentiment(lead.sentiment)
    } as Conversation["lead"] & { sentiment: LeadSentiment },
    online: false,
    unread: 0,
    preview,
    status: lead.status === "ia" ? "ai" : "human",
    messages: [
      {
        id: `${lead.id}-kanban-1`,
        from: "lead",
        text: preview,
        time: lead.lastInteraction || "agora"
      },
      {
        id: `${lead.id}-kanban-2`,
        from: "human",
        text: "Lead aberto pelo funil Kanban para continuidade do atendimento.",
        time: "agora"
      }
    ]
  } satisfies Conversation;
}

export default function ConversasPage() {
  const [activeId, setActiveId] = useState("");
  const [availableConversations, setAvailableConversations] = useState<Conversation[]>([]);
  const [conversationLoadError, setConversationLoadError] = useState("");
  const [manualConversationIds, setManualConversationIds] = useState<string[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(defaultQuickReplies);
  const [conversationQuery, setConversationQuery] = useState("");
  const [inboxView, setInboxView] = useState<InboxView>("all");
  const [archivedConversationIds, setArchivedConversationIds] = useState<string[]>([]);
  const [blockedConversationIds, setBlockedConversationIds] = useState<string[]>([]);
  const [mutedConversationIds, setMutedConversationIds] = useState<string[]>([]);
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>([]);
  const [favoriteConversationIds, setFavoriteConversationIds] = useState<string[]>([]);
  const [temporaryMessageIds, setTemporaryMessageIds] = useState<string[]>([]);
  const [privacyConversationIds, setPrivacyConversationIds] = useState<string[]>([]);
  const [showInboxLists, setShowInboxLists] = useState(false);
  const [inboxLists, setInboxLists] = useState<string[]>(["Clientes auto escola", "Prospeccao quente", "Retorno financeiro"]);
  const [newInboxListName, setNewInboxListName] = useState("");
  const [editingInboxList, setEditingInboxList] = useState<string | null>(null);
  const [editingInboxListName, setEditingInboxListName] = useState("");
  const [activeInboxList, setActiveInboxList] = useState<string | null>(null);
  const [previewTooltip, setPreviewTooltip] = useState<PreviewTooltip>(null);
  const [manageReplies, setManageReplies] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [replyName, setReplyName] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<QuickReplyAttachment | undefined>();
  const [draftMessage, setDraftMessage] = useState("");
  const [draftAttachment, setDraftAttachment] = useState<QuickReplyAttachment | undefined>();
  const [isSendingDraft, setIsSendingDraft] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isChangingHandoff, setIsChangingHandoff] = useState(false);
  const [isFollowUpActionRunning, setIsFollowUpActionRunning] = useState(false);
  const [showLeadProfile, setShowLeadProfile] = useState(false);
  const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [aiSuggestionHint, setAiSuggestionHint] = useState(defaultAiSuggestionHint);
  const [replyFeedback, setReplyFeedback] = useState("");
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [aiAgentName, setAiAgentName] = useState("Camila");
  const [showQuickTools, setShowQuickTools] = useState(false);
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const genericFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef("");
  const lastScrolledLeadIdRef = useRef("");
  const initialUrlSelectionAppliedRef = useRef(false);
  const hasLoadedConversationsRef = useRef(false);
  const filteredConversations = useMemo(() => {
    const normalized = conversationQuery.trim().toLowerCase();
    const visibleByView = availableConversations.filter((conversation, index) => {
      const isArchived = archivedConversationIds.includes(conversation.lead.id);
      const isBlocked = blockedConversationIds.includes(conversation.lead.id);
      const isMuted = mutedConversationIds.includes(conversation.lead.id);

      if (inboxView === "archived") return isArchived;
      if (inboxView === "muted") return isMuted && !isArchived;
      if (isArchived) return false;
      if (inboxView === "favorites") return favoriteConversationIds.includes(conversation.lead.id) || conversation.lead.temperature === "quente" || index === 0;
      if (inboxView === "locked") return isBlocked || manualConversationIds.includes(conversation.lead.id) || conversation.status === "human" || conversation.status === "paused";
      return true;
    }).sort((a, b) => Number(pinnedConversationIds.includes(b.lead.id)) - Number(pinnedConversationIds.includes(a.lead.id)));

    if (!normalized) {
      return visibleByView;
    }

    return visibleByView.filter((conversation) =>
      [
        conversation.lead.name,
        conversation.lead.phone,
        conversation.lead.origin,
        conversation.lead.responsible,
        conversation.preview,
        conversation.lead.notes ?? "",
        conversation.messages.map((message) => message.text).join(" ")
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [archivedConversationIds, availableConversations, blockedConversationIds, conversationQuery, favoriteConversationIds, inboxView, manualConversationIds, mutedConversationIds, pinnedConversationIds]);
  const active = availableConversations.find((conversation) => conversation.lead.id === activeId) ?? availableConversations[0] ?? null;
  const editingReply = quickReplies.find((reply) => reply.id === editingReplyId);
  const canSendDraft = draftMessage.trim().length > 0 || Boolean(draftAttachment);
  const isManualAttendance = active ? manualConversationIds.includes(active.lead.id) || active.status === "human" || active.status === "paused" : false;
  const isActiveFavorite = active ? favoriteConversationIds.includes(active.lead.id) : false;
  const isActiveMuted = active ? mutedConversationIds.includes(active.lead.id) : false;
  const hasTemporaryMessages = active ? temporaryMessageIds.includes(active.lead.id) : false;
  const hasAdvancedPrivacy = active ? privacyConversationIds.includes(active.lead.id) : false;
  const currentAgent = currentUser?.name?.trim() || "Atendente";
  const favoriteCount = availableConversations.filter((conversation, index) => favoriteConversationIds.includes(conversation.lead.id) || conversation.lead.temperature === "quente" || index === 0).length;
  const archivedCount = archivedConversationIds.length;
  const mutedCount = mutedConversationIds.filter((id) => !archivedConversationIds.includes(id)).length;
  const activeConversationId = active ? (active as Conversation & { id?: string }).id : undefined;
  const activeMessageSignature = active
    ? `${active.lead.id}:${active.messages.length}:${active.messages.at(-1)?.id ?? ""}`
    : "";

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadIdentity() {
      const [meResponse, aiResponse] = await Promise.allSettled([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/settings/ai-agent", { cache: "no-store" })
      ]);

      if (!mounted) return;

      if (meResponse.status === "fulfilled" && meResponse.value.ok) {
        const data = await meResponse.value.json().catch(() => null) as { user?: CurrentUser } | null;
        if (data?.user?.name && data.user.role) {
          setCurrentUser({ name: data.user.name, role: data.user.role });
        }
      }

      if (aiResponse.status === "fulfilled" && aiResponse.value.ok) {
        const data = await aiResponse.value.json().catch(() => null) as { agentName?: string } | null;
        if (data?.agentName?.trim()) {
          setAiAgentName(data.agentName.trim());
        }
      }
    }

    void loadIdentity();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    const behavior: ScrollBehavior = lastScrolledLeadIdRef.current === active.lead.id ? "smooth" : "auto";
    lastScrolledLeadIdRef.current = active.lead.id;

    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });

      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });
  }, [active, activeId, activeMessageSignature]);

  useEffect(() => {
    if (!conversationQuery.trim() || filteredConversations.length === 0) {
      return;
    }

    if (!filteredConversations.some((conversation) => conversation.lead.id === activeId)) {
      setActiveId(filteredConversations[0].lead.id);
    }
  }, [activeId, conversationQuery, filteredConversations]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(inboxListsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setInboxLists(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0));
        }
      }
    } catch {
      setInboxLists(["Clientes auto escola", "Prospeccao quente", "Retorno financeiro"]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(inboxListsStorageKey, JSON.stringify(inboxLists));
  }, [inboxLists]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(inboxStateStorageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored) as {
        archived?: unknown;
        blocked?: unknown;
        muted?: unknown;
        pinned?: unknown;
        favorites?: unknown;
        temporary?: unknown;
        privacy?: unknown;
      };

      if (Array.isArray(parsed.archived)) {
        setArchivedConversationIds(parsed.archived.filter((item): item is string => typeof item === "string"));
      }
      if (Array.isArray(parsed.blocked)) {
        setBlockedConversationIds(parsed.blocked.filter((item): item is string => typeof item === "string"));
      }
      if (Array.isArray(parsed.muted)) {
        setMutedConversationIds(parsed.muted.filter((item): item is string => typeof item === "string"));
      }
      if (Array.isArray(parsed.pinned)) {
        setPinnedConversationIds(parsed.pinned.filter((item): item is string => typeof item === "string"));
      }
      if (Array.isArray(parsed.favorites)) {
        setFavoriteConversationIds(parsed.favorites.filter((item): item is string => typeof item === "string"));
      }
      if (Array.isArray(parsed.temporary)) {
        setTemporaryMessageIds(parsed.temporary.filter((item): item is string => typeof item === "string"));
      }
      if (Array.isArray(parsed.privacy)) {
        setPrivacyConversationIds(parsed.privacy.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      setArchivedConversationIds([]);
      setBlockedConversationIds([]);
      setMutedConversationIds([]);
      setPinnedConversationIds([]);
      setFavoriteConversationIds([]);
      setTemporaryMessageIds([]);
      setPrivacyConversationIds([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      inboxStateStorageKey,
      JSON.stringify({
        archived: archivedConversationIds,
        blocked: blockedConversationIds,
        muted: mutedConversationIds,
        pinned: pinnedConversationIds,
        favorites: favoriteConversationIds,
        temporary: temporaryMessageIds,
        privacy: privacyConversationIds
      })
    );
  }, [archivedConversationIds, blockedConversationIds, favoriteConversationIds, mutedConversationIds, pinnedConversationIds, privacyConversationIds, temporaryMessageIds]);

  useEffect(() => {
    let mounted = true;
    let isLoading = false;

    async function loadRealConversations() {
      if (isLoading) return;
      isLoading = true;

      try {
        const response = await fetchWithTimeout("/api/conversations?limit=80&messages=25", { cache: "no-store" }, 15_000);
        const data = await response.json().catch(() => ({})) as { conversations?: Conversation[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Falha ao carregar conversas reais.");
        const mergedConversations = data.conversations ?? [];

        if (!mounted) return;

        setConversationLoadError("");
        setAvailableConversations(mergedConversations);
        hasLoadedConversationsRef.current = true;
        setArchivedConversationIds(mergedConversations.filter((conversation) => conversation.archived).map((conversation) => conversation.lead.id));
        setBlockedConversationIds(mergedConversations.filter((conversation) => conversation.blocked).map((conversation) => conversation.lead.id));
        setMutedConversationIds(mergedConversations.filter((conversation) => conversation.muted).map((conversation) => conversation.lead.id));
        setPinnedConversationIds(mergedConversations.filter((conversation) => conversation.pinned).map((conversation) => conversation.lead.id));

        if (!initialUrlSelectionAppliedRef.current) {
          initialUrlSelectionAppliedRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const leadId = params.get("lead");
          const conversationId = params.get("conversationId");
          const queryMatch = mergedConversations.find((conversation) =>
            (leadId && conversation.lead.id === leadId)
            || (conversationId && (conversation as Conversation & { id?: string }).id === conversationId)
          );

          if (queryMatch) {
            setActiveId(queryMatch.lead.id);
            return;
          }
        }

        const currentActiveId = activeIdRef.current;
        const activeStillExists = mergedConversations.some((conversation) => conversation.lead.id === currentActiveId);

        if (activeStillExists) {
          setActiveId(currentActiveId);
          return;
        }

        if (!currentActiveId) {
          setActiveId(mergedConversations[0]?.lead.id ?? "");
        }
      } catch (error) {
        console.warn("[conversas] falha ao carregar conversas reais", error);
        if (mounted) {
          setConversationLoadError(error instanceof Error ? error.message : "Nao foi possivel carregar as conversas reais.");
        }
        if (mounted && !hasLoadedConversationsRef.current) {
          setAvailableConversations([]);
          setActiveId("");
        }
      } finally {
        isLoading = false;
      }
    }

    loadRealConversations();
    const interval = window.setInterval(loadRealConversations, 10_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadQuickReplies() {
      try {
        const response = await fetch("/api/conversations/quick-replies", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { quickReplies?: QuickReply[] };
        if (!mounted) return;

        if (response.ok && Array.isArray(data.quickReplies) && data.quickReplies.length > 0) {
          setQuickReplies(data.quickReplies);
          return;
        }

        const stored = window.localStorage.getItem(quickReplyStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as QuickReply[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuickReplies(parsed);
          }
        }
      } catch {
        if (mounted) setQuickReplies(defaultQuickReplies);
      }
    }

    loadQuickReplies();

    return () => {
      mounted = false;
    };
  }, []);

  async function persistQuickReplies(nextReplies: QuickReply[]) {
    window.localStorage.setItem(quickReplyStorageKey, JSON.stringify(nextReplies));

    const response = await fetch("/api/conversations/quick-replies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quickReplies: nextReplies })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Nao foi possivel salvar respostas rapidas.");
    }
  }

  useEffect(() => {
    const textarea = draftTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 72)}px`;
  }, [draftMessage]);

  function startNewReply() {
    setEditingReplyId(null);
    setReplyName("");
    setReplyMessage("");
    setReplyAttachment(undefined);
    setManageReplies(true);
  }

  function startEditReply(reply: QuickReply) {
    setEditingReplyId(reply.id);
    setReplyName(reply.name);
    setReplyMessage(reply.message);
    setReplyAttachment(reply.attachment);
    setManageReplies(true);
  }

  function closeReplyManager() {
    setEditingReplyId(null);
    setReplyName("");
    setReplyMessage("");
    setReplyAttachment(undefined);
    setManageReplies(false);
  }

  async function saveQuickReply() {
    const trimmedName = replyName.trim();
    const trimmedMessage = replyMessage.trim();
    if (!trimmedName || (!trimmedMessage && !replyAttachment)) return;

    const nextReplies = editingReplyId
      ? quickReplies.map((item) =>
          item.id === editingReplyId ? { ...item, name: trimmedName, message: trimmedMessage, attachment: replyAttachment } : item
        )
      : [
          ...quickReplies,
          {
            id: crypto.randomUUID(),
            name: trimmedName,
            message: trimmedMessage,
            attachment: replyAttachment
          }
        ];

    try {
      await persistQuickReplies(nextReplies);
      setQuickReplies(nextReplies);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel salvar resposta rapida.");
      return;
    }

    setEditingReplyId(null);
    setReplyName("");
    setReplyMessage("");
    setReplyAttachment(undefined);
    setManageReplies(false);
  }

  async function deleteQuickReply(replyId: string) {
    const nextReplies = quickReplies.filter((item) => item.id !== replyId);
    await persistQuickReplies(nextReplies);
    setQuickReplies(nextReplies);
    if (editingReplyId === replyId) {
      setEditingReplyId(null);
      setReplyName("");
      setReplyMessage("");
      setReplyAttachment(undefined);
    }
  }

  async function confirmDeleteQuickReply() {
    if (!deleteReplyId) return;

    try {
      await deleteQuickReply(deleteReplyId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel excluir resposta rapida.");
      return;
    }

    setDeleteReplyId(null);
    setReplyFeedback("Mensagem excluida com sucesso.");
    window.setTimeout(() => setReplyFeedback(""), 2600);
  }

  async function sendDraftMessage() {
    if (!active || isSendingDraft) return;

    const trimmedMessage = draftMessage.trim();
    const textToSend = trimmedMessage || (draftAttachment ? `${attachmentLabel(draftAttachment.type)}: ${draftAttachment.name}` : "");
    if (!textToSend) return;

    setIsSendingDraft(true);

    try {
      const response = await fetch("/api/conversations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: active.lead.id,
          text: trimmedMessage,
          attachment: draftAttachment
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: Conversation["messages"][number];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Nao foi possivel enviar a mensagem.");
      }

      const sentMessage = payload.message ?? {
        id: `manual-${Date.now()}`,
        from: "human" as const,
        text: textToSend,
        time: "agora"
      };

      setAvailableConversations((items) =>
        items.map((conversation) =>
          conversation.lead.id === active.lead.id
            ? {
                ...conversation,
                status: "human",
                preview: sentMessage.text,
                messages: [...conversation.messages, sentMessage],
                lead: {
                  ...conversation.lead,
                  lastInteraction: "agora",
                  responsible: currentAgent
                }
              }
            : conversation
        )
      );
      setManualConversationIds((ids) => (ids.includes(active.lead.id) ? ids : [...ids, active.lead.id]));
      setDraftMessage("");
      setDraftAttachment(undefined);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel enviar a mensagem.");
    } finally {
      setIsSendingDraft(false);
    }
  }

  function startEditMessage(message: Conversation["messages"][number]) {
    if (message.from === "lead") return;
    setEditingMessageId(message.id);
    setEditingMessageText(message.text);
  }

  function cancelEditMessage() {
    setEditingMessageId(null);
    setEditingMessageText("");
  }

  async function saveEditedMessage() {
    if (!active || !editingMessageId) return;

    const content = editingMessageText.trim();
    if (!content) {
      window.alert("A mensagem nao pode ficar vazia.");
      return;
    }

    try {
      const response = await fetch(`/api/conversations/messages/${editingMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: { content?: string } };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel editar a mensagem.");
      }

      setAvailableConversations((items) =>
        items.map((conversation) => {
          if (conversation.lead.id !== active.lead.id) return conversation;

          const messages = conversation.messages.map((message) =>
            message.id === editingMessageId
              ? { ...message, text: payload.message?.content ?? content }
              : message
          );

          return {
            ...conversation,
            preview: conversation.messages.at(-1)?.id === editingMessageId ? content : conversation.preview,
            messages
          };
        })
      );
      cancelEditMessage();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel editar a mensagem.");
    }
  }

  async function deleteSentMessage(messageId: string) {
    if (!active || deletingMessageId) return;

    const confirmed = window.confirm("Tem certeza que deseja apagar esta mensagem do chat?");
    if (!confirmed) return;

    setDeletingMessageId(messageId);

    try {
      const response = await fetch(`/api/conversations/messages/${messageId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; warning?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel apagar a mensagem.");
      }

      setAvailableConversations((items) =>
        items.map((conversation) => {
          if (conversation.lead.id !== active.lead.id) return conversation;

          const messages = conversation.messages.filter((message) => message.id !== messageId);
          const lastMessage = messages.at(-1);

          return {
            ...conversation,
            preview: lastMessage?.text ?? conversation.preview,
            messages
          };
        })
      );
      if (editingMessageId === messageId) cancelEditMessage();
      if (payload.warning) {
        window.alert(payload.warning);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel apagar a mensagem.");
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function assumeConversation() {
    if (!active || isChangingHandoff) return;

    if (!activeConversationId) {
      window.alert("Conversa ainda nao sincronizada com o banco.");
      return;
    }

    setIsChangingHandoff(true);

    try {
      const response = await fetch(`/api/conversations/${activeConversationId}/assume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Atendente assumiu manualmente pela central." })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel assumir a conversa.");
      }

      setManualConversationIds((ids) => (ids.includes(active.lead.id) ? ids : [...ids, active.lead.id]));
      setAvailableConversations((items) =>
        items.map((conversation) =>
          conversation.lead.id === active.lead.id
            ? {
                ...conversation,
                status: "human",
                lead: {
                  ...conversation.lead,
                  responsible: currentAgent
                },
                preview: "Atendimento assumido por Carla Vendas."
              }
            : conversation
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel assumir a conversa.");
    } finally {
      setIsChangingHandoff(false);
    }
  }

  async function returnConversationToAi() {
    if (!active || isChangingHandoff) return;

    if (!activeConversationId) {
      window.alert("Conversa ainda nao sincronizada com o banco.");
      return;
    }

    setIsChangingHandoff(true);

    try {
      const response = await fetch(`/api/conversations/${activeConversationId}/return-to-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Atendimento devolvido manualmente para IA." })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel devolver a conversa para IA.");
      }

      setManualConversationIds((ids) => ids.filter((id) => id !== active.lead.id));
      setAvailableConversations((items) =>
        items.map((conversation) =>
          conversation.lead.id === active.lead.id
            ? {
                ...conversation,
                status: "ai",
                preview: "IA retomou o atendimento automatico."
              }
            : conversation
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel devolver a conversa para IA.");
    } finally {
      setIsChangingHandoff(false);
    }
  }

  async function runFollowUpAction(action: "send-now" | "pause" | "resume") {
    if (!active || isFollowUpActionRunning) return;

    setIsFollowUpActionRunning(true);
    try {
      const response = await fetch("/api/leads/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: active.lead.id, action })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: { followUpNumber?: number; nextFollowUpAt?: string | null; message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel executar o follow-up.");
      }

      setAvailableConversations((items) =>
        items.map((conversation) => {
          if (conversation.lead.id !== active.lead.id) return conversation;

          const lead = conversation.lead as Conversation["lead"] & {
            followUpCount?: number;
            nextFollowUpAt?: string | null;
            followUpPausedAt?: string | null;
          };
          const nextLead = { ...lead };

          if (action === "pause") {
            nextLead.followUpPausedAt = new Date().toISOString();
            nextLead.nextFollowUpAt = null;
          }
          if (action === "resume") {
            nextLead.followUpPausedAt = null;
          }
          if (action === "send-now") {
            nextLead.followUpCount = payload.result?.followUpNumber ?? (lead.followUpCount ?? 0) + 1;
            nextLead.nextFollowUpAt = payload.result?.nextFollowUpAt ?? null;
          }

          const nextMessages = action === "send-now" && payload.result?.message
            ? [
                ...conversation.messages,
                {
                  id: `follow-up-${Date.now()}`,
                  from: "ia" as const,
                  text: payload.result.message,
                  time: "agora"
                }
              ]
            : conversation.messages;

          return {
            ...conversation,
            lead: nextLead,
            preview: action === "send-now" && payload.result?.message ? payload.result.message : conversation.preview,
            messages: nextMessages
          };
        })
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel executar o follow-up.");
    } finally {
      setIsFollowUpActionRunning(false);
    }
  }

  function applyQuickReply(reply: QuickReply) {
    setDraftMessage(reply.message);
    setDraftAttachment(reply.attachment);
  }

  async function generateContextualAiSuggestion() {
    if (!active || isGeneratingSuggestion) return;

    setIsGeneratingSuggestion(true);
    setAiSuggestionHint("A IA esta lendo a conversa e preparando uma sugestao...");

    try {
      const response = await fetch("/api/conversations/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: active.lead.id })
      });
      const payload = await response.json().catch(() => ({})) as { suggestion?: string; error?: string };

      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error || "Nao foi possivel gerar sugestao da IA.");
      }

      setDraftMessage(payload.suggestion);
      setAiSuggestionHint(payload.suggestion);
      window.setTimeout(() => draftTextareaRef.current?.focus(), 50);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel gerar sugestao da IA.";
      setAiSuggestionHint(message);
      window.alert(message);
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }

  function uploadReplyAttachment(file?: File) {
    if (!file) return;

    const type = attachmentTypeFromMime(file.type);
    if (!type) return;

    const reader = new FileReader();
    reader.onload = () => {
      setReplyAttachment({
        name: file.name,
        type,
        dataUrl: String(reader.result)
      });
    };
    reader.readAsDataURL(file);
  }

  function uploadDraftAttachment(file?: File) {
    if (!file) return;

    const type = attachmentTypeFromMime(file.type);
    if (!type) {
      window.alert("Formato nao suportado. Envie audio, imagem ou video.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraftAttachment({
        name: file.name,
        type,
        dataUrl: String(reader.result)
      });
      window.setTimeout(() => draftTextareaRef.current?.focus(), 50);
    };
    reader.readAsDataURL(file);
  }

  function handleDraftAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    uploadDraftAttachment(event.target.files?.[0]);
    event.target.value = "";
  }

  function insertEmoji() {
    const emoji = "🙂";
    const textarea = draftTextareaRef.current;
    if (!textarea) {
      setDraftMessage((value) => `${value}${emoji}`);
      return;
    }

    const start = textarea.selectionStart ?? draftMessage.length;
    const end = textarea.selectionEnd ?? draftMessage.length;
    const nextMessage = `${draftMessage.slice(0, start)}${emoji}${draftMessage.slice(end)}`;
    setDraftMessage(nextMessage);

    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function toggleAudioRecording() {
    if (isRecordingAudio) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      window.alert("Gravacao de audio nao esta disponivel neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);

        if (!blob.size) return;

        const reader = new FileReader();
        reader.onload = () => {
          const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
          setDraftAttachment({
            name: `audio-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
            type: "audio",
            dataUrl: String(reader.result)
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecordingAudio(true);
    } catch {
      window.alert("Nao foi possivel acessar o microfone. Verifique a permissao do navegador.");
    }
  }

  function updateDraftMessage(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraftMessage(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 72)}px`;
  }

  function selectInboxView(view: InboxView) {
    setInboxView(view);
    setActiveInboxList(null);
  }

  function selectInboxList(listName: string) {
    setActiveInboxList(listName);
    setInboxView("all");
    setShowInboxLists(false);
  }

  function selectNextConversationAfter(currentId: string) {
    const next = availableConversations.find((conversation) => conversation.lead.id !== currentId && !archivedConversationIds.includes(conversation.lead.id));
    if (next) {
      setActiveId(next.lead.id);
    }
  }

  function conversationApiIdFromLeadId(leadId: string) {
    return availableConversations.find((conversation) => conversation.lead.id === leadId)?.id;
  }

  async function persistConversationAction(leadId: string, action: "archive" | "unarchive" | "mute" | "unmute" | "pin" | "unpin" | "block" | "unblock" | "clear" | "delete") {
    const conversationId = conversationApiIdFromLeadId(leadId);
    if (!conversationId) {
      window.alert("Conversa ainda nao sincronizada com o banco.");
      return false;
    }

    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Nao foi possivel atualizar a conversa.");
    }

    return true;
  }

  async function toggleArchiveConversation(conversationId: string) {
    const isArchived = archivedConversationIds.includes(conversationId);

    try {
      const persisted = await persistConversationAction(conversationId, isArchived ? "unarchive" : "archive");
      if (!persisted) return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel arquivar a conversa.");
      return;
    }

    setArchivedConversationIds((ids) => (isArchived ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
    setAvailableConversations((items) =>
      items.map((conversation) =>
        conversation.lead.id === conversationId ? { ...conversation, archived: !isArchived } : conversation
      )
    );
    setOpenConversationMenuId(null);

    if (!isArchived && activeId === conversationId) {
      selectNextConversationAfter(conversationId);
    }
  }

  async function toggleMuteConversation(conversationId: string) {
    const isMuted = mutedConversationIds.includes(conversationId);
    try {
      const persisted = await persistConversationAction(conversationId, isMuted ? "unmute" : "mute");
      if (!persisted) return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel silenciar a conversa.");
      return;
    }

    setMutedConversationIds((ids) => (ids.includes(conversationId) ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
    setAvailableConversations((items) =>
      items.map((conversation) =>
        conversation.lead.id === conversationId ? { ...conversation, muted: !isMuted } : conversation
      )
    );
    setOpenConversationMenuId(null);
  }

  async function togglePinConversation(conversationId: string) {
    const isPinned = pinnedConversationIds.includes(conversationId);
    try {
      const persisted = await persistConversationAction(conversationId, isPinned ? "unpin" : "pin");
      if (!persisted) return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel fixar a conversa.");
      return;
    }

    setPinnedConversationIds((ids) => (ids.includes(conversationId) ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
    setAvailableConversations((items) =>
      items.map((conversation) =>
        conversation.lead.id === conversationId ? { ...conversation, pinned: !isPinned } : conversation
      )
    );
    setOpenConversationMenuId(null);
  }

  function toggleFavoriteConversation(conversationId: string) {
    setFavoriteConversationIds((ids) => (ids.includes(conversationId) ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
  }

  function toggleTemporaryMessages(conversationId: string) {
    setTemporaryMessageIds((ids) => (ids.includes(conversationId) ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
  }

  function togglePrivacyConversation(conversationId: string) {
    setPrivacyConversationIds((ids) => (ids.includes(conversationId) ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
  }

  async function toggleBlockConversation(conversationId: string) {
    const isBlocked = blockedConversationIds.includes(conversationId);
    const confirmed = window.confirm(isBlocked ? "Deseja desbloquear esta conversa?" : "Deseja bloquear esta conversa?");
    if (!confirmed) return;

    try {
      const persisted = await persistConversationAction(conversationId, isBlocked ? "unblock" : "block");
      if (!persisted) return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel bloquear a conversa.");
      return;
    }

    setBlockedConversationIds((ids) => (isBlocked ? ids.filter((id) => id !== conversationId) : [conversationId, ...ids]));
    setAvailableConversations((items) =>
      items.map((conversation) =>
        conversation.lead.id === conversationId
          ? {
              ...conversation,
              blocked: !isBlocked,
              status: "human",
              preview: isBlocked ? "Conversa desbloqueada." : "Conversa bloqueada."
            }
          : conversation
      )
    );
    setOpenConversationMenuId(null);
  }

  async function clearConversation(conversationId: string) {
    const confirmed = window.confirm("Deseja limpar o historico desta conversa?");
    if (!confirmed) return;

    try {
      const persisted = await persistConversationAction(conversationId, "clear");
      if (!persisted) return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel limpar a conversa.");
      return;
    }

    setAvailableConversations((items) =>
      items.map((conversation) =>
        conversation.lead.id === conversationId
          ? {
              ...conversation,
              cleared: true,
              unread: 0,
              preview: "Conversa limpa.",
              messages: []
            }
          : conversation
      )
    );
    setOpenConversationMenuId(null);
  }

  async function deleteConversation(conversationId: string) {
    const confirmed = window.confirm("Deseja apagar esta conversa da caixa de entrada?");
    if (!confirmed) return;

    try {
      const persisted = await persistConversationAction(conversationId, "delete");
      if (!persisted) return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel apagar a conversa.");
      return;
    }

    setAvailableConversations((items) => items.filter((conversation) => conversation.lead.id !== conversationId));
    setArchivedConversationIds((ids) => ids.filter((id) => id !== conversationId));
    setBlockedConversationIds((ids) => ids.filter((id) => id !== conversationId));
    setMutedConversationIds((ids) => ids.filter((id) => id !== conversationId));
    setPinnedConversationIds((ids) => ids.filter((id) => id !== conversationId));
    if (activeId === conversationId) {
      const next = availableConversations.find((conversation) => conversation.lead.id !== conversationId);
      if (next) {
        setActiveId(next.lead.id);
      }
    }
    setOpenConversationMenuId(null);
  }

  function createInboxList() {
    const listName = newInboxListName.trim();
    if (!listName) return;

    setInboxLists((current) => (current.some((item) => item.toLowerCase() === listName.toLowerCase()) ? current : [listName, ...current]));
    setNewInboxListName("");
  }

  function startEditInboxList(listName: string) {
    setEditingInboxList(listName);
    setEditingInboxListName(listName);
  }

  function saveEditedInboxList() {
    const nextName = editingInboxListName.trim();
    if (!editingInboxList || !nextName) return;

    setInboxLists((current) =>
      current.map((item) => (item === editingInboxList ? nextName : item)).filter((item, index, array) => array.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index)
    );
    if (activeInboxList === editingInboxList) {
      setActiveInboxList(nextName);
    }
    setEditingInboxList(null);
    setEditingInboxListName("");
  }

  function deleteInboxList(listName: string) {
    const confirmed = window.confirm(`Deseja apagar a lista "${listName}"?`);
    if (!confirmed) return;

    setInboxLists((current) => current.filter((item) => item !== listName));
    if (activeInboxList === listName) {
      setActiveInboxList(null);
      setInboxView("all");
    }
  }

  function showPreviewTooltip(event: MouseEvent<HTMLElement>, text: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPreviewTooltip({
      text,
      top: Math.max(84, rect.top + rect.height / 2),
      left: Math.min(window.innerWidth - 360, rect.right + 18)
    });
  }

  if (!active) {
    return (
      <>
        <Topbar
          title="Central de Atendimento"
          subtitle="WhatsApp + IA com intervencao humana sem perda de contexto"
          searchValue={conversationQuery}
          onSearchChange={setConversationQuery}
        />
        <div className="grid h-[calc(100dvh-64px)] min-h-0 grid-cols-1 overflow-hidden bg-[radial-gradient(circle_at_42%_0%,rgba(11,95,165,0.10),transparent_34%),#0B1120] md:grid-cols-[380px_1fr]">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/[0.08] bg-[#060a12]/95 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold">Caixa de entrada</h2>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                0 ativos
              </span>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm font-bold text-muted-foreground">
              {conversationLoadError || "Aguardando conversas reais recebidas pela Evolution API."}
            </div>
          </aside>
          <main className="grid place-items-center p-6">
            <div className="max-w-md rounded-[22px] border border-white/[0.08] bg-card/70 p-6 text-center shadow-panel">
              <MessageCircle className="mx-auto size-9 text-primary" />
              <h2 className="mt-4 text-lg font-black">
                {conversationLoadError ? "Falha ao carregar conversas" : "Nenhuma conversa real ainda"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {conversationLoadError
                  ? conversationLoadError
                  : "Quando o WhatsApp enviar mensagens pelo webhook, elas devem aparecer aqui com o lead e o historico real."}
              </p>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Central de Atendimento"
        subtitle="WhatsApp + IA com intervencao humana sem perda de contexto"
        searchValue={conversationQuery}
        onSearchChange={setConversationQuery}
      />
      {previewTooltip ? (
        <div
          className="pointer-events-none fixed z-[220] w-[min(340px,calc(100vw-2rem))] -translate-y-1/2 rounded-xl border border-white/10 bg-[#0b1120]/98 p-3 text-xs leading-5 text-slate-100 opacity-100 shadow-[0_24px_70px_rgba(0,0,0,0.56)] backdrop-blur-xl"
          style={{ top: previewTooltip.top, left: previewTooltip.left }}
        >
          {previewTooltip.text}
        </div>
      ) : null}
      <div
        className={cn(
          "grid h-[calc(100dvh-64px)] min-h-0 grid-cols-1 overflow-hidden bg-[radial-gradient(circle_at_42%_0%,rgba(11,95,165,0.10),transparent_34%),linear-gradient(180deg,rgba(250,204,21,0.035),transparent_24%),#0B1120] md:grid-cols-[380px_1fr]",
          showLeadProfile ? "xl:grid-cols-[380px_minmax(0,1fr)_300px]" : "xl:grid-cols-[380px_minmax(0,1fr)]"
        )}
      >
        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/[0.08] bg-[#060a12]/95 shadow-[inset_-18px_0_42px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="shrink-0 border-b border-white/[0.08] bg-[#080d16]/92 p-3">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold">Caixa de entrada</h2>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                {availableConversations.length} ativos
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Buscar conversa..."
                className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.045] pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/70 hover:border-white/[0.16] focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
              />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {[
                  { id: "all" as const, label: "Tudo", count: availableConversations.length },
                  { id: "favorites" as const, label: "Favoritos", count: favoriteCount }
                ].map((item) => {
                  const active = !activeInboxList && inboxView === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectInboxView(item.id)}
                      className={cn(
                        "h-8 shrink-0 rounded-full border px-3 text-xs font-bold transition",
                        active
                          ? "border-primary/45 bg-primary/18 text-primary"
                          : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:text-foreground"
                      )}
                    >
                      <span>{item.label}</span>
                      <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-[#0B1120]/18" : "bg-white/[0.06]")}>{item.count}</span>
                    </button>
                  );
                })}
                {activeInboxList ? (
                  <button
                    type="button"
                    className="h-8 shrink-0 rounded-full border border-primary/45 bg-primary/18 px-3 text-xs font-bold text-primary"
                  >
                    {activeInboxList}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInboxLists(true);
                  setEditingInboxList(null);
                }}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/12 text-primary transition hover:bg-primary/20"
                aria-label="Criar nova lista"
              >
                <Plus className="size-4" />
              </button>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInboxLists((current) => !current)}
                  className={cn(
                    "grid size-8 place-items-center rounded-full border transition",
                    showInboxLists
                      ? "border-primary/40 bg-primary/14 text-primary"
                      : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:text-foreground"
                  )}
                  aria-label="Abrir listas da caixa de entrada"
                >
                  <ChevronDown className={cn("size-4 transition", showInboxLists && "rotate-180")} />
                </button>
                {showInboxLists ? (
                  <div className="absolute right-0 top-9 z-[120] w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1120]/[0.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.52)] backdrop-blur-xl">
                    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Cadastrar lista</p>
                      <div className="flex items-center gap-2">
                        <input
                          value={newInboxListName}
                          onChange={(event) => setNewInboxListName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              createInboxList();
                            }
                          }}
                          placeholder="Nome da nova lista"
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-xs font-semibold text-white outline-none placeholder:text-muted-foreground focus:border-primary/50"
                        />
                        <button
                          type="button"
                          onClick={createInboxList}
                          className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-105"
                          aria-label="Cadastrar nova lista"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                      {inboxLists.map((listName) => (
                        <div
                          key={listName}
                          className={cn(
                            "group/list flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.06]",
                            activeInboxList === listName ? "text-primary" : "text-slate-100"
                          )}
                        >
                          {editingInboxList === listName ? (
                            <input
                              value={editingInboxListName}
                              onChange={(event) => setEditingInboxListName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveEditedInboxList();
                                }
                                if (event.key === "Escape") {
                                  setEditingInboxList(null);
                                  setEditingInboxListName("");
                                }
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-primary/30 bg-[#111827] px-2 py-1.5 text-xs font-bold text-white outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => selectInboxList(listName)}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left text-xs font-bold"
                            >
                              <Star className="size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{listName}</span>
                              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">0</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => (editingInboxList === listName ? saveEditedInboxList() : startEditInboxList(listName))}
                            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-primary/10 hover:text-primary group-hover/list:opacity-100"
                            aria-label={`Editar lista ${listName}`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteInboxList(listName)}
                            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-red-500/10 hover:text-red-300 group-hover/list:opacity-100"
                            aria-label={`Apagar lista ${listName}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      onClick={() => {
                        selectInboxView("locked");
                        setShowInboxLists(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-100 transition hover:bg-white/[0.06]"
                    >
                      <LockKeyhole className="size-4 text-muted-foreground" />
                      Conversas trancadas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectInboxView("muted");
                        setShowInboxLists(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-100 transition hover:bg-white/[0.06]"
                    >
                      <VolumeX className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">Silenciadas</span>
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">{mutedCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectInboxView("archived");
                        setShowInboxLists(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-100 transition hover:bg-white/[0.06]"
                    >
                      <Archive className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">Arquivadas</span>
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">{archivedCount}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_0%,rgba(11,95,165,0.07),transparent_30%),#050912] px-2 py-2 pr-3 [scrollbar-gutter:stable] scrollbar-thin">
            {filteredConversations.map((conversation) => {
              const selected = conversation.lead.id === activeId;
              const chance = closingChanceByTemperature[conversation.lead.temperature];
              const isArchived = archivedConversationIds.includes(conversation.lead.id);
              const isBlocked = blockedConversationIds.includes(conversation.lead.id);
              const isMuted = mutedConversationIds.includes(conversation.lead.id);
              const isPinned = pinnedConversationIds.includes(conversation.lead.id);

              return (
                <div
                  key={conversation.lead.id}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 border-b border-white/[0.06] px-2 py-2.5 text-left transition-all duration-200 last:border-b-0 hover:z-[85] hover:bg-[#101827]/88",
                    selected && "rounded-xl border-b-transparent bg-[#111827] shadow-[inset_3px_0_0_#FACC15,0_12px_30px_rgba(0,0,0,0.26)]",
                    openConversationMenuId === conversation.lead.id && "z-[80]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(conversation.lead.id);
                      setOpenConversationMenuId(null);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                  <div className="relative shrink-0">
                    <LeadInitialAvatar name={conversation.lead.name} avatar={conversation.lead.avatar} temperature={conversation.lead.temperature} size="sm" neutral />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        {isPinned ? <Pin className="size-3 shrink-0 text-primary" /> : null}
                        {isBlocked ? <Ban className="size-3 shrink-0 text-red-200" /> : null}
                        {isMuted ? <VolumeX className="size-3 shrink-0 text-muted-foreground" /> : null}
                        <span className="truncate text-[13px] font-extrabold">{conversation.lead.name}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{conversation.lead.lastInteraction}</span>
                    </div>
                    <div
                      className="group/preview relative mt-0.5 flex items-center gap-1.5"
                      onMouseEnter={(event) => showPreviewTooltip(event, conversation.preview)}
                      onMouseLeave={() => setPreviewTooltip(null)}
                    >
                      <p className="flex-1 truncate text-[11px] text-muted-foreground">{conversation.preview}</p>
                      {conversation.unread > 0 ? (
                        <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </div>
                    {false ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-bold capitalize", temperatureClasses[conversation.lead.temperature])}>
                        {temperatureEmoji[conversation.lead.temperature]} {conversation.lead.temperature}
                      </span>
                      <span className="rounded-full border border-[#0B5FA5]/35 bg-[#0B5FA5]/16 px-1.5 py-0.5 text-[9px] font-bold text-blue-100">
                        {originEmoji[conversation.lead.origin] ?? "📍"} {conversation.lead.origin}
                      </span>
                      <span className="ml-auto rounded-full border border-white/10 bg-white/[0.045] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                        {chance}%
                      </span>
                    </div>
                    ) : null}
                  </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenConversationMenuId((current) => (current === conversation.lead.id ? null : conversation.lead.id))}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-white/[0.08] hover:text-foreground group-hover:opacity-100"
                    aria-label="Acoes da conversa"
                  >
                    <ChevronDown className={cn("size-4 transition", openConversationMenuId === conversation.lead.id && "rotate-180")} />
                  </button>
                  {openConversationMenuId === conversation.lead.id ? (
                    <ConversationInboxMenu
                      onClose={() => setOpenConversationMenuId(null)}
                      onArchive={() => toggleArchiveConversation(conversation.lead.id)}
                      onBlock={() => toggleBlockConversation(conversation.lead.id)}
                      onClear={() => clearConversation(conversation.lead.id)}
                      onDelete={() => deleteConversation(conversation.lead.id)}
                      onMute={() => toggleMuteConversation(conversation.lead.id)}
                      onPin={() => togglePinConversation(conversation.lead.id)}
                      isArchived={isArchived}
                      isBlocked={isBlocked}
                      isMuted={isMuted}
                      isPinned={isPinned}
                    />
                  ) : null}
                </div>
              );
            })}
            {filteredConversations.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center text-xs font-semibold text-muted-foreground">
                {conversationLoadError || "Nenhuma conversa encontrada."}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[#0B1120]/74">
          <div className="border-b border-white/[0.08] bg-[#111827]/72 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onDoubleClick={() => setShowLeadProfile((current) => !current)}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 py-1 text-left transition hover:bg-white/[0.035]"
                title={showLeadProfile ? "Duplo clique para recolher dados do contato" : "Duplo clique para abrir dados do contato"}
                aria-label={`${showLeadProfile ? "Recolher" : "Abrir"} dados do contato ${active.lead.name} com duplo clique`}
              >
                <LeadInitialAvatar name={active.lead.name} avatar={active.lead.avatar} temperature={active.lead.temperature} size="lg" />
                <span className="min-w-0 flex-1 truncate text-base font-extrabold transition group-hover:text-primary">
                  {active.lead.name}
                </span>
              </button>
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold sm:inline-flex",
                  isManualAttendance
                    ? "border-[#FACC15]/40 bg-[#FACC15]/14 text-[#FACC15] shadow-[0_0_20px_rgba(250,204,21,0.12)]"
                    : "border-[#0B5FA5]/50 bg-[#0B5FA5]/18 text-blue-100 shadow-[0_0_22px_rgba(11,95,165,0.16)]"
                )}
              >
                {isManualAttendance ? <UserCheck className="size-3" /> : <Sparkles className="size-3" />}
                {isManualAttendance ? `Piloto: ${currentAgent}` : "IA conduzindo"}
              </span>
              <button
                onClick={() => void (isManualAttendance ? returnConversationToAi() : assumeConversation())}
                disabled={isChangingHandoff}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0",
                  isManualAttendance
                    ? "border-[#0B5FA5]/50 bg-[#0B5FA5]/16 text-blue-100 shadow-[0_0_22px_rgba(11,95,165,0.14)] hover:border-[#38BDF8]/45 hover:bg-[#0B5FA5]/24"
                    : "border-[#0B5FA5]/35 bg-[#0B5FA5]/10 text-blue-100 hover:border-[#0B5FA5]/55 hover:bg-[#0B5FA5]/18"
                )}
              >
                {isManualAttendance ? <Sparkles className="size-3.5" /> : <Pause className="size-3.5" />}
                {isManualAttendance ? "Devolver para IA" : "Pausar IA"}
              </button>
              <button
                onClick={() => void assumeConversation()}
                disabled={isManualAttendance || isChangingHandoff}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0",
                  isManualAttendance
                    ? "border border-[#FACC15]/45 bg-[#FACC15]/16 text-[#FACC15] shadow-[0_0_24px_rgba(250,204,21,0.14)]"
                    : "bg-primary text-primary-foreground"
                )}
              >
                <UserCheck className="size-3.5" />
                {isManualAttendance ? "Assumido" : "Assumir"}
              </button>
            </div>
          </div>

          <div ref={chatScrollRef} className="whatsapp-chat-bg flex-1 overflow-y-auto p-4 scrollbar-thin">
            <div className="flex w-full flex-col space-y-4">
            {active.messages.map((message) => {
              const isCompany = message.from !== "lead";
              const isEditingMessage = editingMessageId === message.id;
              const canManageMessage = isCompany && isPersistedMessageId(message.id);
              const displayText = messageTextForDisplay(message);

              return (
                <div key={message.id} className={cn("flex", isCompany ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "group/message relative min-w-[300px] max-w-[78%] rounded-2xl border px-4 py-3 text-sm shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur transition hover:-translate-y-0.5 md:min-w-[460px]",
                      isCompany
                        ? "border-primary/30 bg-primary/[0.14]"
                        : "border-white/10 bg-card/86"
                    )}
                  >
                    {canManageMessage && !isEditingMessage ? (
                      <div className="absolute right-3 top-2 flex translate-y-1 gap-1 opacity-0 transition group-hover/message:translate-y-0 group-hover/message:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEditMessage(message)}
                          className="grid size-7 place-items-center rounded-lg border border-white/10 bg-background/80 text-muted-foreground shadow-lg transition hover:border-primary/40 hover:text-primary"
                          title="Editar mensagem"
                          aria-label="Editar mensagem"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSentMessage(message.id)}
                          disabled={deletingMessageId === message.id}
                          className="grid size-7 place-items-center rounded-lg border border-white/10 bg-background/80 text-muted-foreground shadow-lg transition hover:border-red-400/40 hover:text-red-200 disabled:cursor-wait disabled:opacity-60"
                          title="Apagar mensagem"
                          aria-label="Apagar mensagem"
                        >
                          {deletingMessageId === message.id ? <Clock3 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        </button>
                      </div>
                    ) : null}
                    {message.from === "ia" ? (
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Bot className="size-3" />
                        {formatAiSender(aiAgentName)}
                      </div>
                    ) : null}
                    {message.from === "human" ? (
                      <div className="mb-1.5 inline-flex rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                        {formatHumanSender(message, currentUser)}
                      </div>
                    ) : null}
                    {isEditingMessage ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingMessageText}
                          onChange={(event) => setEditingMessageText(event.target.value)}
                          className="kanban-input min-h-24 resize-y text-sm leading-6"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditMessage}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-white/20 hover:text-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveEditedMessage()}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold text-primary-foreground transition hover:-translate-y-0.5"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ChatMediaAttachment message={message} />
                        {displayText ? (
                          <p className="leading-6">
                            {message.media?.type === "audio" ? (
                              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                Transcricao
                              </span>
                            ) : null}
                            {displayText}
                          </p>
                        ) : null}
                      </>
                    )}
                    <div className="mt-1 text-right text-[10px] text-muted-foreground">{message.time}</div>
                  </div>
                </div>
              );
            })}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          </div>

          <div className="border-t border-white/[0.06] bg-[#080808] p-4 backdrop-blur-xl">
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setShowQuickTools((value) => !value)}
                className={cn(
                  "grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary",
                  showQuickTools && "border-primary/40 bg-primary/10 text-primary"
                )}
                aria-expanded={showQuickTools}
                aria-label={showQuickTools ? "Recolher respostas rapidas" : "Abrir respostas rapidas"}
                title={showQuickTools ? "Recolher respostas rapidas" : "Abrir respostas rapidas"}
              >
                <ChevronDown className={cn("size-3.5 transition-transform", showQuickTools && "rotate-180")} />
              </button>
            </div>
            {showQuickTools ? (
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void generateContextualAiSuggestion()}
                disabled={!active || isGeneratingSuggestion}
                className="group/ai-hint relative inline-flex shrink-0 items-center gap-2 overflow-visible rounded-full border border-[#0B5FA5]/40 bg-[#0B5FA5]/18 px-3 py-1.5 text-xs font-black text-blue-100 shadow-[0_0_18px_rgba(11,95,165,0.14)] transition hover:-translate-y-0.5 hover:border-[#0B5FA5]/70 hover:bg-[#0B5FA5]/24 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
                title="Clique para a IA ler a conversa e preencher uma mensagem sugerida."
              >
                {isGeneratingSuggestion ? <Clock3 className="size-3.5 animate-spin text-blue-200" /> : <WandSparkles className="size-3.5 text-blue-200" />}
                {isGeneratingSuggestion ? "Gerando..." : "Sugestao de IA"}
                <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-[min(420px,calc(100vw-2rem))] translate-y-1 rounded-2xl border border-[#0B5FA5]/28 bg-[#07111f]/98 p-3 text-left text-xs font-semibold leading-5 text-blue-50 opacity-0 shadow-[0_22px_60px_rgba(0,0,0,0.45),0_0_24px_rgba(11,95,165,0.12)] backdrop-blur-xl transition-all duration-200 group-hover/ai-hint:translate-y-0 group-hover/ai-hint:opacity-100">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                    Sugestao contextual
                  </span>
                  {aiSuggestionHint}
                </span>
              </button>

              <div className="flex items-center gap-2">
                {replyFeedback ? (
                  <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                    {replyFeedback}
                  </span>
                ) : null}
                <button
                  onClick={startNewReply}
                  className={cn(
                    "shrink-0 rounded-full border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-accent hover:text-white",
                    manageReplies && "border-primary/50 bg-primary/10 text-primary"
                  )}
                >
                  Gerenciar respostas rapidas
                </button>
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2 overflow-x-auto scrollbar-thin">
              {quickReplies.map((quickReply) => (
                <div key={quickReply.id} className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] pr-1">
                  <button
                    onClick={() => applyQuickReply(quickReply)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold hover:text-primary"
                    title={quickReply.message || quickReply.attachment?.name}
                  >
                    {quickReply.attachment ? <AttachmentIcon type={quickReply.attachment.type} className="size-3" /> : null}
                    {quickReply.name}
                  </button>
                  <div className="flex items-center border-l border-border pl-1">
                    <button
                      onClick={() => startEditReply(quickReply)}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      title="Editar resposta rapida"
                      aria-label={`Editar resposta rapida ${quickReply.name}`}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => setDeleteReplyId(quickReply.id)}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                      title="Excluir resposta rapida"
                      aria-label={`Excluir resposta rapida ${quickReply.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
            ) : null}
            {draftAttachment ? (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <AttachmentIcon type={draftAttachment.type} className="size-4 shrink-0" />
                  <span className="truncate">
                    {attachmentLabel(draftAttachment.type)} pronto para envio: {draftAttachment.name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setDraftAttachment(undefined)}
                  className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-white/10"
                  aria-label="Remover anexo da mensagem"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <input
              ref={genericFileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleDraftAttachmentChange}
            />
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleDraftAttachmentChange}
            />
            <div className="flex min-h-14 items-end gap-4">
              <button
                type="button"
                onClick={() => genericFileInputRef.current?.click()}
                className="grid size-10 shrink-0 place-items-center text-white/90 transition hover:text-white"
                title="Anexar arquivo"
                aria-label="Anexar imagem, video ou audio"
              >
                <Plus className="size-8 stroke-[1.8]" />
              </button>
              <div className="flex min-h-12 min-w-0 flex-1 items-end rounded-[24px] bg-[#242424] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <textarea
                  ref={draftTextareaRef}
                  value={draftMessage}
                  onChange={updateDraftMessage}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendDraftMessage();
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  rows={1}
                  className="max-h-[72px] min-h-8 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm leading-6 text-white outline-none placeholder:text-white/45 scrollbar-thin"
                />
                <button
                  type="button"
                  onClick={insertEmoji}
                  className="grid size-9 shrink-0 place-items-center text-white/90 transition hover:text-white"
                  title="Inserir emoji"
                  aria-label="Inserir emoji"
                >
                  <Smile className="size-6 stroke-[1.8]" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="grid size-10 shrink-0 place-items-center text-white/90 transition hover:text-white"
                title="Enviar foto ou video"
                aria-label="Enviar foto ou video"
              >
                <Camera className="size-7 stroke-[1.8]" />
              </button>
              <button
                type="button"
                onClick={() => (isRecordingAudio ? void toggleAudioRecording() : canSendDraft ? void sendDraftMessage() : void toggleAudioRecording())}
                disabled={isSendingDraft}
                className={cn(
                  "grid size-10 shrink-0 place-items-center text-white/90 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/35",
                  isRecordingAudio && "text-primary drop-shadow-[0_0_12px_rgba(250,204,21,0.45)]"
                )}
                aria-label={isRecordingAudio ? "Parar gravacao de audio" : canSendDraft ? "Enviar mensagem" : "Gravar audio"}
                title={isRecordingAudio ? "Parar gravacao" : canSendDraft ? "Enviar mensagem" : "Gravar audio"}
              >
                {canSendDraft && !isRecordingAudio ? <Send className="size-7 stroke-[1.8]" /> : <Mic className="size-8 stroke-[1.8]" />}
              </button>
            </div>
          </div>
        </section>

        {showLeadProfile ? (
        <aside className="hidden min-h-0 flex-col gap-2.5 overflow-y-auto border-l border-white/[0.06] bg-[#070c14]/92 p-3 backdrop-blur-xl scrollbar-thin xl:flex">
          <section className="relative rounded-2xl border border-white/[0.08] bg-[linear-gradient(145deg,rgba(17,24,39,0.72),rgba(8,13,22,0.92))] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.20)]">
            <div className="absolute right-3 top-3">
              <button
                type="button"
                onClick={() => setShowLeadProfile(false)}
                className="grid size-7 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-slate-400 transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                aria-label="Fechar painel do lead"
                title="Fechar painel do lead"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col items-center pt-1 text-center">
              <LeadInitialAvatar name={active.lead.name} avatar={active.lead.avatar} temperature={active.lead.temperature} size="xl" />
              <div className="mt-3 min-w-0">
                <div className="max-w-[230px] truncate text-sm font-extrabold text-slate-100">{active.lead.name}</div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{active.lead.phone}</div>
              </div>
              <button
                type="button"
                className="mt-3 grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-slate-300 transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                title="Pesquisar na conversa"
                aria-label="Pesquisar na conversa"
              >
                <Search className="size-4" />
              </button>
              <div className="mt-3 max-w-full text-left">
                <div className="text-[10px] font-semibold text-slate-500">Recado</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{active.lead.notes ?? active.preview}</p>
              </div>
              <span className={cn("mt-3 rounded-lg border px-2 py-1 text-[9px] font-black", isManualAttendance ? "border-[#FACC15]/28 bg-[#FACC15]/8 text-[#FACC15]" : "border-[#0B5FA5]/26 bg-[#0B5FA5]/10 text-sky-100")}>
                {isManualAttendance ? "Piloto" : "IA ativa"}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <CompactLeadMeter
                icon={Thermometer}
                label="Termometro"
                value={active.lead.temperature}
                helper={temperatureBar[active.lead.temperature].label}
                width={temperatureBar[active.lead.temperature].width}
              />
              <CompactLeadMeter
                icon={Smile}
                label="Sentimento"
                value={getLeadSentiment(active)}
                helper={sentimentBar[getLeadSentiment(active)].label}
                width={sentimentBar[getLeadSentiment(active)].width}
              />
            </div>
            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#0B1120]/62 p-2.5">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-black uppercase tracking-[0.16em] text-slate-400">Follow-up</span>
                <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-bold text-slate-300">
                  {((active.lead as Conversation["lead"] & { followUpCount?: number }).followUpCount ?? 0)}/5
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => void runFollowUpAction("send-now")}
                  disabled={isFollowUpActionRunning}
                  className="rounded-xl border border-[#FACC15]/22 bg-[#FACC15]/10 px-2 py-2 text-[10px] font-black text-[#FACC15] transition hover:bg-[#FACC15]/16 disabled:opacity-50"
                >
                  Enviar agora
                </button>
                <button
                  type="button"
                  onClick={() => void runFollowUpAction("pause")}
                  disabled={isFollowUpActionRunning}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-2 text-[10px] font-black text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-50"
                >
                  Pausar
                </button>
                <button
                  type="button"
                  onClick={() => void runFollowUpAction("resume")}
                  disabled={isFollowUpActionRunning}
                  className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-2 py-2 text-[10px] font-black text-sky-100 transition hover:bg-sky-400/14 disabled:opacity-50"
                >
                  Retomar
                </button>
              </div>
            </div>
          </section>

          <ExpandableSection
            title="Dados do lead"
            subtitle="Abrir quando precisar"
            icon={Gauge}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Origem" value={`${originEmoji[active.lead.origin] ?? "📍"} ${active.lead.origin}`} compact />
                <Info label="Etapa" value={`${stageEmoji[active.lead.stage] ?? "📌"} ${stageLabels[active.lead.stage] ?? active.lead.stage}`} compact />
                <Info label="Interesse" value={`🚗 CNH ${active.lead.interest}`} compact />
                <Info label="Responsavel" value={active.lead.responsible} compact />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Thermometer className="size-3.5 text-[#FACC15]" />
                  <span>Termometro do cliente</span>
                </div>
                <div className="mt-1.5 rounded-2xl border border-white/[0.07] bg-[#0B1120]/58 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[10px] font-bold capitalize text-slate-200">
                      <span aria-hidden="true">{temperatureEmoji[active.lead.temperature]}</span>
                      {active.lead.temperature}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {temperatureBar[active.lead.temperature].label}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0B5FA5] via-[#38BDF8] to-[#FACC15]"
                      style={{ width: temperatureBar[active.lead.temperature].width }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Smile className="size-3.5 text-[#FACC15]" />
                  <span>Sentimento do cliente</span>
                </div>
                <div className="mt-1.5 rounded-2xl border border-white/[0.07] bg-[#0B1120]/58 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[10px] font-bold capitalize text-slate-200">
                      <span aria-hidden="true">{sentimentEmoji[getLeadSentiment(active)]}</span>
                      {getLeadSentiment(active)}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {sentimentBar[getLeadSentiment(active)].label}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1F2937] via-[#0B5FA5] to-[#FACC15]"
                      style={{ width: sentimentBar[getLeadSentiment(active)].width }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ExpandableSection>

          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(145deg,rgba(17,24,39,0.58),rgba(8,13,22,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
            <ContactPanelRow icon={ImageIcon} label="Midia, links e docs" value="5" />
            <ContactPanelRow
              icon={Star}
              label="Mensagens favoritas"
              onClick={() => toggleFavoriteConversation(active.lead.id)}
              active={isActiveFavorite}
            />
            <ContactPanelRow
              icon={VolumeX}
              label="Silenciar notificacoes"
              onClick={() => toggleMuteConversation(active.lead.id)}
              active={isActiveMuted}
              toggle
            />
            <ContactPanelRow
              icon={Clock3}
              label="Mensagens temporarias"
              detail={hasTemporaryMessages ? "Ativadas" : "Desativadas"}
              onClick={() => toggleTemporaryMessages(active.lead.id)}
              active={hasTemporaryMessages}
            />
            <ContactPanelRow
              icon={LockKeyhole}
              label="Privacidade avancada"
              detail={hasAdvancedPrivacy ? "Ativada" : "Desativada"}
              onClick={() => togglePrivacyConversation(active.lead.id)}
              active={hasAdvancedPrivacy}
            />
            <ContactPanelRow
              icon={LockKeyhole}
              label="Criptografia"
              detail="Mensagens protegidas de ponta a ponta."
            />
          </section>

          <button
            onClick={() => setShowLeadProfile(true)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-primary/25 bg-primary/10 text-xs font-bold text-primary transition hover:-translate-y-0.5 hover:bg-primary/15"
          >
            <Zap className="size-3.5 text-primary" />
            Ver perfil completo
          </button>
        </aside>
        ) : null}
      </div>

      {deleteReplyId ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
            <h2 className="text-base font-extrabold">Excluir resposta rapida?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tem certeza que deseja excluir esta mensagem rapida?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteReplyId(null)}
                className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                Nao
              </button>
              <button
                type="button"
                onClick={confirmDeleteQuickReply}
                className="h-10 rounded-xl bg-danger px-4 text-sm font-bold text-white transition hover:brightness-110"
              >
                Sim
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {manageReplies ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl">
          <section className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#08111f] shadow-[0_28px_90px_rgba(0,0,0,0.52)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Respostas rapidas</p>
                <h2 className="mt-1 text-xl font-extrabold">
                  {editingReply ? "Editar resposta rapida" : "Cadastrar resposta rapida"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure texto, audio, imagem ou video para usar durante o atendimento.
                </p>
              </div>
              <button
                onClick={closeReplyManager}
                className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
                title="Fechar gerenciamento"
                aria-label="Fechar gerenciamento"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Nome do botao</span>
                  <input
                    value={replyName}
                    onChange={(event) => setReplyName(event.target.value)}
                    placeholder="Ex: Valores"
                    className="h-12 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold outline-none transition placeholder:text-muted-foreground/70 hover:border-white/[0.16] focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Mensagem completa</span>
                  <textarea
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    placeholder="Digite o texto completo que sera inserido no chat..."
                    rows={4}
                    className="min-h-28 resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-muted-foreground/70 hover:border-white/[0.16] focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">Midia da resposta</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Opcional. A resposta pode ser salva mesmo sem texto se tiver anexo.
                    </p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-xs font-bold text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground">
                    <ImageIcon className="size-4" />
                    Anexar audio, imagem ou video
                    <input
                      type="file"
                      accept="audio/*,image/*,video/*"
                      onChange={(event) => uploadReplyAttachment(event.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>

                {replyAttachment ? (
                  <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                    <AttachmentIcon type={replyAttachment.type} className="size-4 shrink-0" />
                    <span className="truncate">
                      {attachmentLabel(replyAttachment.type)}: {replyAttachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyAttachment(undefined)}
                      className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-white/10"
                      aria-label="Remover anexo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5">
              <button
                onClick={() => {
                  setEditingReplyId(null);
                  setReplyName("");
                  setReplyMessage("");
                  setReplyAttachment(undefined);
                }}
                className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                Limpar
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeReplyManager}
                  className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveQuickReply}
                  className="h-10 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:-translate-y-0.5"
                >
                  Salvar resposta
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {false ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/55 backdrop-blur-sm">
          <section className="flex h-dvh w-full max-w-[430px] flex-col overflow-hidden border-l border-white/10 bg-[#f9fafb] text-[#111827] shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
            <div className="relative border-b border-slate-200 bg-white p-6 text-center">
              <LeadInitialAvatar name={active.lead.name} avatar={active.lead.avatar} temperature={active.lead.temperature} size="xl" />
              <div className="mx-auto mt-3 min-w-0">
                <h2 className="truncate text-lg font-medium text-slate-950">{active.lead.name}</h2>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {active.lead.phone}
                  </span>
                  <span>•</span>
                  <span>{originEmoji[active.lead.origin] ?? "📍"} {active.lead.origin}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeadProfile(false)}
                className="absolute left-3 top-3 grid size-8 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100"
                aria-label="Fechar perfil do cliente"
              >
                <X className="size-4" />
              </button>
              <button
                type="button"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100"
                aria-label="Editar contato"
              >
                <Pencil className="size-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 scrollbar-thin">
              <div className="flex justify-center">
                <button className="grid size-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100">
                  <Search className="size-4" />
                </button>
              </div>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] text-slate-500">Recado</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">{active.lead.notes ?? active.preview}</p>
              </section>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <ContactPanelRow icon={ImageIcon} label="Midia, links e docs" value="5" />
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200 px-10 py-8">
                  <button className="mx-auto grid size-11 place-items-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300">
                    <Archive className="size-5" />
                  </button>
                  <button className="mx-auto grid size-11 place-items-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300">
                    <ImageIcon className="size-5" />
                  </button>
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <ContactPanelRow
                  icon={Star}
                  label="Mensagens favoritas"
                  onClick={() => toggleFavoriteConversation(active.lead.id)}
                  active={isActiveFavorite}
                />
                <ContactPanelRow
                  icon={VolumeX}
                  label="Silenciar notificacoes"
                  onClick={() => toggleMuteConversation(active.lead.id)}
                  active={isActiveMuted}
                  toggle
                />
                <ContactPanelRow
                  icon={Clock3}
                  label="Mensagens temporarias"
                  detail={hasTemporaryMessages ? "Ativadas" : "Desativadas"}
                  onClick={() => toggleTemporaryMessages(active.lead.id)}
                  active={hasTemporaryMessages}
                />
                <ContactPanelRow
                  icon={LockKeyhole}
                  label="Privacidade avancada da conversa"
                  detail={hasAdvancedPrivacy ? "Ativada" : "Desativada"}
                  onClick={() => togglePrivacyConversation(active.lead.id)}
                  active={hasAdvancedPrivacy}
                />
                <ContactPanelRow
                  icon={LockKeyhole}
                  label="Criptografia"
                  detail="As mensagens sao protegidas com criptografia de ponta a ponta. Clique para verificar."
                />
              </section>
              <div className="space-y-4">
                <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <h3 className="text-sm font-extrabold">Resumo comercial</h3>
                  <div className="mt-4 grid gap-3">
                    <ProfileRow label="Termometro" value={`${temperatureEmoji[active.lead.temperature]} ${active.lead.temperature}`} />
                    <ProfileRow label="Etapa" value={`${stageEmoji[active.lead.stage] ?? "📌"} ${stageLabels[active.lead.stage] ?? active.lead.stage}`} />
                    <ProfileRow label="Interesse" value={`🚗 CNH ${active.lead.interest}`} />
                    <ProfileRow label="Responsavel" value={active.lead.responsible} />
                    <ProfileRow label="Ultima interacao" value={active.lead.lastInteraction} />
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <h3 className="text-sm font-extrabold">Observacoes</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {active.lead.notes ?? active.preview}
                  </p>
                </section>
              </div>

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="text-sm font-extrabold">Historico da conversa</h3>
                <div className="mt-4 space-y-3">
                  {active.messages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white/[0.08] bg-background/35 p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-primary">
                          {message.from === "lead" ? "Cliente" : message.from === "ia" ? "IA" : "Atendente"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{message.time}</span>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{message.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function CompactLeadMeter({
  icon: Icon,
  label,
  value,
  helper,
  width
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
  width: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0B1120]/58 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
          <Icon className="size-3.5 text-[#FACC15]" />
          {label}
        </span>
        <span className="truncate text-[10px] font-bold capitalize text-slate-200">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#0B5FA5] via-[#38BDF8] to-[#FACC15]" style={{ width }} />
      </div>
      <p className="mt-1 truncate text-[10px] font-semibold text-muted-foreground">{helper}</p>
    </div>
  );
}

function ContactPanelRow({
  icon: Icon,
  label,
  detail,
  value,
  active = false,
  toggle = false,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
  value?: string;
  active?: boolean;
  toggle?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-white/[0.045]"
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-slate-400")} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-200">{label}</span>
        {detail ? <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{detail}</span> : null}
      </span>
      {value ? <span className="text-xs font-bold text-muted-foreground">{value}</span> : null}
      {toggle ? (
        <span className={cn("relative h-5 w-9 rounded-full border transition", active ? "border-primary/40 bg-primary/25" : "border-white/[0.08] bg-white/[0.045]")}>
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-slate-200 shadow transition", active ? "left-4" : "left-0.5")} />
        </span>
      ) : null}
    </button>
  );
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn(compact && "rounded-xl border border-white/[0.07] bg-[#0B1120]/58 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]")}>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn("mt-0.5 font-semibold capitalize text-slate-200", compact ? "truncate text-xs" : "text-sm")}>{value}</div>
    </div>
  );
}

function ExpandableSection({
  title,
  subtitle,
  icon: Icon,
  defaultOpen = false,
  children
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(17,24,39,0.62),rgba(8,13,22,0.82))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-[#0B5FA5]/24 hover:bg-white/[0.045]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-[#0B1120]/70 text-slate-300">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-slate-100">{title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 border-t border-white/[0.06] pt-3">{children}</div>
    </details>
  );
}

function InsightPill({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[#0B5FA5]/14 text-blue-100">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-xs font-extrabold">{value}</div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-white/[0.035] px-3 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-bold capitalize">{value}</span>
    </div>
  );
}

