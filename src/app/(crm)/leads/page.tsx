"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Trash2,
  FileText,
  Flame,
  Gauge,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  UserRound,
  X,
  Zap
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";

type LeadStage =
  | "novo"
  | "ia"
  | "atendimento"
  | "followup"
  | "perdido"
  | "matricula_pendente"
  | "matricula_realizada";

type LeadInterest = "carro" | "moto" | "adicao" | "mudanca";

type LeadRecord = {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  origin: string;
  status: LeadStage;
  temperature: "quente" | "morno" | "frio" | "urgente";
  sentiment: "positivo" | "neutro" | "duvida" | "negativo";
  lastMessage: string;
  lastInteraction: string;
  responsible: string;
  initials: string;
  notes: string;
  interest?: LeadInterest;
  archived?: boolean;
};

type LeadDraft = {
  name: string;
  phone: string;
  origin: string;
  status: LeadStage;
  temperature: LeadRecord["temperature"];
  sentiment: LeadRecord["sentiment"];
  responsible: string;
  interest: LeadInterest;
  lastMessage: string;
  notes: string;
};

type QuickFilter = "todos" | "quentes" | "sem_resposta" | "ia" | "matriculas" | "hoje" | "whatsapp" | "meta";

const origins = ["WhatsApp", "Meta Ads", "Google Ads", "Instagram", "Indicacao", "Site"];

const stages: Array<{ id: LeadStage; label: string; tone: string }> = [
  { id: "novo", label: "Novo Lead", tone: "border-primary/35 bg-primary/10 text-primary" },
  { id: "ia", label: "IA Atendendo", tone: "border-[#0f4c8a]/45 bg-[#0f4c8a]/16 text-blue-100" },
  { id: "atendimento", label: "Em Atendimento", tone: "border-white/15 bg-white/[0.06] text-slate-100" },
  { id: "followup", label: "Follow-up", tone: "border-primary/30 bg-primary/10 text-primary" },
  { id: "perdido", label: "Sem Retorno", tone: "border-danger/30 bg-danger/10 text-red-200" },
  { id: "matricula_pendente", label: "Matricula Pendente", tone: "border-primary/30 bg-primary/10 text-primary" },
  { id: "matricula_realizada", label: "Matricula Realizada", tone: "border-success/30 bg-success/10 text-success" }
];

const quickFilters: Array<{ id: QuickFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "quentes", label: "Quentes" },
  { id: "sem_resposta", label: "Sem resposta" },
  { id: "ia", label: "IA ativa" },
  { id: "matriculas", label: "Matriculas" },
  { id: "hoje", label: "Hoje" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "meta", label: "Meta Ads" }
];

const legacyStageMap: Record<string, LeadStage> = {
  novo: "novo",
  ia: "ia",
  qualificado: "atendimento",
  atendimento: "atendimento",
  orcamento: "atendimento",
  negociacao: "followup",
  interessado: "followup",
  interessado_followup: "followup",
  followup: "followup",
  agendado: "matricula_pendente",
  fechado: "matricula_realizada",
  perdido: "perdido",
  matricula_pendente: "matricula_pendente",
  matricula_realizada: "matricula_realizada"
};

const stageFromMock: Record<string, LeadStage> = {
  novo: "novo",
  ia: "ia",
  qualificado: "atendimento",
  interessado: "followup",
  negociacao: "followup",
  followup: "followup",
  fechado: "matricula_realizada",
  perdido: "perdido"
};

const quickMessages = [
  "Solicitou valores e condicoes para CNH B.",
  "Quer falar com consultor antes de fechar matricula.",
  "Pediu disponibilidade para aulas no periodo noturno.",
  "Recebeu proposta e esta comparando formas de pagamento.",
  "Lead pronto para agendamento de visita.",
  "Aguardando retorno do responsavel comercial."
];

const emptyDraft: LeadDraft = {
  name: "",
  phone: "",
  origin: "WhatsApp",
  status: "novo",
  temperature: "quente",
  sentiment: "positivo",
  responsible: "Equipe comercial",
  interest: "carro",
  lastMessage: "",
  notes: ""
};

const temperatureConfig: Record<LeadRecord["temperature"], { label: string; tone: string; rail: string; bar: string; priority: string }> = {
  quente: {
    label: "Quente",
    tone: "border-success/30 bg-success/10 text-success",
    rail: "bg-success/12",
    bar: "w-[82%] bg-gradient-to-r from-success to-primary",
    priority: "from-success/55"
  },
  morno: {
    label: "Morno",
    tone: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
    rail: "bg-yellow-400/12",
    bar: "w-[58%] bg-gradient-to-r from-yellow-400 to-amber-300",
    priority: "from-yellow-400/55"
  },
  frio: {
    label: "Frio",
    tone: "border-[#0f4c8a]/40 bg-[#0f4c8a]/16 text-blue-100",
    rail: "bg-[#0f4c8a]/18",
    bar: "w-[34%] bg-gradient-to-r from-[#0f4c8a] to-[#f9fafb]",
    priority: "from-[#0f4c8a]/55"
  },
  urgente: {
    label: "Urgente",
    tone: "border-danger/30 bg-danger/10 text-red-200",
    rail: "bg-danger/12",
    bar: "w-[95%] bg-gradient-to-r from-danger to-primary",
    priority: "from-danger/60"
  }
};

const sentimentConfig: Record<LeadRecord["sentiment"], { label: string; tone: string }> = {
  positivo: { label: "Positivo", tone: "border-success/30 bg-success/10 text-success" },
  neutro: { label: "Neutro", tone: "border-slate-400/30 bg-slate-400/10 text-slate-200" },
  duvida: { label: "Em duvida", tone: "border-primary/30 bg-primary/10 text-primary" },
  negativo: { label: "Negativo", tone: "border-danger/30 bg-danger/10 text-red-200" }
};

const aiStatusConfig = {
  active: { label: "IA ativa", tone: "border-primary/30 bg-primary/10 text-primary", dot: "bg-primary" },
  paused: { label: "IA pausada", tone: "border-slate-400/30 bg-slate-400/10 text-slate-200", dot: "bg-slate-300" },
  handoff: { label: "Aguardando humano", tone: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200", dot: "bg-yellow-300" }
};

function initialsFromName(name: string) {
  return name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function LeadInitialFrame({
  lead,
  size = "md"
}: {
  lead: Pick<LeadRecord, "initials" | "temperature" | "avatar">;
  size?: "md" | "lg";
}) {
  const sizes = {
    md: "size-12 text-sm",
    lg: "size-14 text-base"
  };

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-mono font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_30px_rgba(0,0,0,0.24)]",
        lead.avatar ? "border-white/12 bg-[#111827]" : "border-[#FACC15]/55 bg-[linear-gradient(135deg,#FACC15,#EAB308)] text-[#0B1120] shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_18px_rgba(250,204,21,0.16),0_12px_30px_rgba(0,0,0,0.24)]",
        sizes[size]
      )}
    >
      {lead.avatar ? (
        <img src={lead.avatar} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="relative z-10">{lead.initials}</span>
      )}
    </div>
  );
}

function stageLabel(stage: LeadStage) {
  return stages.find((item) => item.id === stage)?.label ?? stage;
}

function stageTone(stage: LeadStage) {
  return stages.find((item) => item.id === stage)?.tone ?? "border-white/10 bg-white/[0.04] text-slate-200";
}

function createInitialLeads(): LeadRecord[] {
  return [];
}

function migrateStoredLeads(leads: LeadRecord[]) {
  return leads.map((lead, index) => ({
    ...lead,
    status: legacyStageMap[lead.status] ?? "novo",
    sentiment: lead.sentiment ?? "neutro",
    initials: lead.initials ?? initialsFromName(lead.name),
    lastMessage: lead.lastMessage ?? quickMessages[index % quickMessages.length],
    notes: lead.notes ?? "Lead em acompanhamento comercial.",
    interest: lead.interest ?? "carro"
  }));
}

function aiScore(lead: LeadRecord) {
  const tempScore = { urgente: 94, quente: 86, morno: 68, frio: 42 }[lead.temperature];
  const stageScore: Record<LeadStage, number> = {
    novo: 4,
    ia: 8,
    atendimento: 16,
    followup: 10,
    perdido: -28,
    matricula_pendente: 26,
    matricula_realizada: 34
  };
  return Math.max(12, Math.min(98, tempScore + stageScore[lead.status] - 8));
}

function aiState(lead: LeadRecord): keyof typeof aiStatusConfig {
  if (lead.status === "ia") return "active";
  if (["atendimento", "followup"].includes(lead.status)) return "handoff";
  return "paused";
}

function timeTone(lead: LeadRecord) {
  const value = lead.lastInteraction.toLowerCase();
  if (value.includes("dia") || value.includes("ontem") || value.includes("18h")) return "border-red-400/30 bg-red-400/10 text-red-200";
  if (value.includes("h")) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
}

function originTone(origin: string) {
  const value = origin.toLowerCase();
  if (value.includes("whatsapp")) return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (value.includes("instagram")) return "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200";
  if (value.includes("google")) return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  if (value.includes("meta") || value.includes("facebook")) return "border-blue-400/25 bg-blue-400/10 text-blue-200";
  if (value.includes("site")) return "border-cyan-400/25 bg-cyan-400/10 text-cyan-200";
  return "border-primary/25 bg-primary/10 text-primary";
}

function pulseStatus(lead: LeadRecord) {
  const score = aiScore(lead);
  const time = lead.lastInteraction.toLowerCase();

  if (lead.temperature === "urgente") {
    return { icon: "🔥", label: "Alta intenção", tooltip: "Lead demonstrou alta intenção de compra.", tone: "border-primary/35 bg-primary/10 text-primary" };
  }
  if (score >= 92) {
    return { icon: "⭐", label: "VIP", tooltip: "Lead de alto valor ou prioridade.", tone: "border-[#FACC15]/35 bg-[#FACC15]/10 text-[#FACC15]" };
  }
  if (lead.temperature === "quente" || lead.status === "matricula_pendente") {
    return { icon: "●", label: "Pronto", tooltip: "Lead pronto para fechamento.", tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" };
  }
  if (time.includes("h") || lead.status === "followup") {
    return { icon: "●", label: "Aguardando", tooltip: "Lead aguardando retorno do cliente.", tone: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200" };
  }
  if (time.includes("dia") || time.includes("ontem")) {
    return { icon: "●", label: "Parado", tooltip: "Lead parado ha mais de 24 horas sem interacao.", tone: "border-red-400/30 bg-red-400/10 text-red-200" };
  }

  return { icon: "●", label: "Ativo", tooltip: "Lead em acompanhamento comercial ativo.", tone: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200" };
}

function nextActionTone(lead: LeadRecord) {
  if (lead.status === "matricula_pendente") return "border-primary/35 bg-primary/10 text-primary";
  if (lead.temperature === "urgente" || lead.temperature === "quente") return "border-[#FACC15]/35 bg-[#FACC15]/10 text-[#FACC15]";
  if (lead.status === "followup") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  return "border-white/10 bg-white/[0.045] text-slate-200";
}

function isUnanswered(lead: LeadRecord) {
  const value = lead.lastInteraction.toLowerCase();
  return lead.status === "followup" || value.includes("h") || value.includes("dia") || value.includes("ontem");
}

function nextAction(lead: LeadRecord) {
  const actions: Record<LeadStage, string> = {
    novo: "Confirmar interesse e categoria",
    ia: "Monitorar IA e qualificacao",
    atendimento: "Responder duvida comercial",
    followup: "Retomar contato hoje",
    perdido: "Registrar motivo da perda",
    matricula_pendente: "Conferir documentos",
    matricula_realizada: "Enviar boas-vindas"
  };
  return actions[lead.status];
}

function intentText(lead: LeadRecord) {
  if (lead.status === "matricula_realizada") return "Matricula concluida";
  if (lead.temperature === "urgente") return "Alta urgencia detectada";
  if (lead.temperature === "quente") return "Intencao forte de compra";
  if (lead.status === "followup") return "Aguardando retorno";
  return "Lead em nutricao";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draft, setDraft] = useState<LeadDraft>(emptyDraft);

  useEffect(() => {
    let mounted = true;

    async function loadRealLeads() {
      try {
        const search = new URLSearchParams(window.location.search).get("search") ?? "";
        const response = await fetch(`/api/leads?search=${encodeURIComponent(search)}&limit=500`, { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar leads reais.");
        const data = await response.json() as { leads?: LeadRecord[] };

        if (mounted) {
          setLeads(migrateStoredLeads(data.leads ?? []));
          if (search) setQuery(search);
          return;
        }
      } catch (error) {
        console.warn("[leads] falha ao carregar dados reais", error);
      }

      if (!mounted) return;

      setLeads(createInitialLeads());

      const search = new URLSearchParams(window.location.search).get("search");
      if (search) {
        setQuery(search);
      }
    }

    loadRealLeads();

    return () => {
      mounted = false;
    };
  }, []);

  const activeLeads = useMemo(() => leads.filter((lead) => !lead.archived), [leads]);

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeLeads.filter((lead) => {
      const matchesQuery =
        normalized.length === 0 ||
        [lead.name, lead.phone, lead.origin, lead.responsible, lead.lastMessage, lead.notes].some((value) =>
          value.toLowerCase().includes(normalized)
        );

      const matchesQuickFilter =
        quickFilter === "todos" ||
        (quickFilter === "quentes" && ["quente", "urgente"].includes(lead.temperature)) ||
        (quickFilter === "sem_resposta" && isUnanswered(lead)) ||
        (quickFilter === "ia" && aiState(lead) === "active") ||
        (quickFilter === "matriculas" && ["matricula_pendente", "matricula_realizada"].includes(lead.status)) ||
        (quickFilter === "hoje" && (lead.lastInteraction.includes("min") || lead.lastInteraction.includes("h") || lead.lastInteraction === "agora")) ||
        (quickFilter === "whatsapp" && lead.origin === "WhatsApp") ||
        (quickFilter === "meta" && lead.origin === "Meta Ads");

      return matchesQuery && matchesQuickFilter;
    });
  }, [activeLeads, query, quickFilter]);

  const selectedLead = activeLeads.find((lead) => lead.id === selectedLeadId) ?? null;

  const kpis = useMemo(() => {
    const hot = activeLeads.filter((lead) => ["quente", "urgente"].includes(lead.temperature)).length;
    const unanswered = activeLeads.filter(isUnanswered).length;
    const aiNow = activeLeads.filter((lead) => aiState(lead) === "active").length;
    const potential = activeLeads.reduce((sum, lead) => {
      const base = lead.interest === "moto" ? 1350 : lead.interest === "adicao" ? 1600 : 2100;
      return sum + Math.round(base * (aiScore(lead) / 100));
    }, 0);
    const closed = activeLeads.filter((lead) => lead.status === "matricula_realizada").length;
    const conversion = activeLeads.length ? Math.round((closed / activeLeads.length) * 100) : 0;
    const followups = activeLeads.filter((lead) => lead.status === "followup" || timeTone(lead).includes("red")).length;

    return { hot, unanswered, aiNow, potential, conversion, followups };
  }, [activeLeads]);

  function openCreateModal() {
    setDraft(emptyDraft);
    setShowCreateModal(true);
  }

  async function saveLead() {
    if (!draft.name.trim()) return;

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          phone: draft.phone.trim() || "+55 00 90000-0000",
          lastMessage: draft.lastMessage.trim() || "Novo lead cadastrado manualmente.",
          notes: draft.notes.trim() || "Lead criado pela pagina Leads."
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { lead?: LeadRecord; error?: string };

      if (!response.ok || !payload.lead) {
        throw new Error(payload.error ?? "Nao foi possivel salvar o lead.");
      }

      const [createdLead] = migrateStoredLeads([payload.lead]);
      setLeads((current) => [createdLead, ...current.filter((lead) => lead.id !== createdLead.id)]);
      setSelectedLeadId(createdLead.id);
      setShowCreateModal(false);
      setDraft(emptyDraft);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel salvar o lead.");
    }
  }

  async function confirmDeleteLead() {
    if (!deleteLeadId) return;

    const response = await fetch(`/api/leads?id=${encodeURIComponent(deleteLeadId)}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({})) as { error?: string };

    if (!response.ok) {
      window.alert(payload.error || "Seu usuario nao tem permissao para excluir leads.");
      return;
    }

    setLeads((current) => current.filter((lead) => lead.id !== deleteLeadId));
    if (selectedLeadId === deleteLeadId) {
      setSelectedLeadId(null);
    }
    setDeleteLeadId(null);
  }

  return (
    <>
      <Topbar
        title="Leads"
        subtitle="Central inteligente de fechamento de matriculas"
        searchValue={query}
        onSearchChange={setQuery}
        onNewLead={openCreateModal}
      />

      <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_18%_0%,rgba(250,204,21,0.12),transparent_30%),radial-gradient(circle_at_82%_6%,rgba(34,211,238,0.10),transparent_34%),var(--background)] p-4 scrollbar-thin xl:p-6">
        <details className="group mb-5 overflow-hidden rounded-[24px] border border-white/10 bg-card/52 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <TrendingUp className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">Indicadores de apoio</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {filteredLeads.length} leads visiveis, {kpis.hot} quentes, {kpis.followups} follow-ups atrasados
              </span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
          </summary>

          <section className="grid gap-3 border-t border-white/[0.07] p-4 md:grid-cols-2 xl:grid-cols-6">
            <KpiCard icon={Flame} label="Leads quentes" value={String(kpis.hot)} trend="+12%" detail="prioridade alta" tone="from-success/18" />
            <KpiCard icon={AlertCircle} label="Sem resposta" value={String(kpis.unanswered)} trend="-8%" detail="precisam retorno" tone="from-danger/18" />
            <KpiCard icon={Bot} label="IA atendendo" value={String(kpis.aiNow)} trend="ao vivo" detail="fluxo automatico" tone="from-primary/18" />
            <KpiCard icon={TrendingUp} label="Receita potencial" value={formatCurrency(kpis.potential)} trend="+21%" detail="pipeline aberto" tone="from-primary/20" compact />
            <KpiCard icon={Gauge} label="Conversao mes" value={`${kpis.conversion}%`} trend="+3.4%" detail="matriculas" tone="from-[#0f4c8a]/18" />
            <KpiCard icon={Clock3} label="Follow-ups atrasados" value={String(kpis.followups)} trend="hoje" detail="acao comercial" tone="from-primary/18" />
          </section>
        </details>

        <section className="mb-5 overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,24,39,0.86),rgba(11,17,32,0.74))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] backdrop-blur-xl xl:p-5">
          <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(520px,1fr)_auto] xl:items-center">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {quickFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setQuickFilter(filter.id)}
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-xl border px-2 text-center text-[11px] font-black transition duration-200 hover:-translate-y-0.5",
                    quickFilter === filter.id
                      ? "border-primary/55 bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(250,204,21,0.18)]"
                      : "border-white/10 bg-white/[0.045] text-muted-foreground hover:border-white/20 hover:bg-white/[0.075] hover:text-foreground"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-[0_12px_34px_rgba(250,204,21,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 xl:justify-self-end"
            >
              <Plus className="size-4" />
              Novo Lead
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-card/62 shadow-panel backdrop-blur-xl">
          <div className="sticky top-0 z-20 grid gap-3 border-b border-white/10 bg-[#0b1422]/96 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-xl max-xl:hidden xl:grid-cols-[minmax(220px,1.35fr)_0.75fr_0.9fr_1.2fr_0.95fr_0.75fr_0.9fr_1fr_0.8fr]">
            <span>Lead</span>
            <span>Origem</span>
            <span>Etapa</span>
            <span>Direcionamento</span>
            <span>Pulso Comercial</span>
            <span>Score IA</span>
            <span>Ultimo Contato</span>
            <span>Proxima Acao</span>
            <span>Acoes</span>
          </div>

          <div className="divide-y divide-white/[0.07]">
            {filteredLeads.map((lead, index) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                index={index}
                onOpen={() => setSelectedLeadId(lead.id)}
                onAskDelete={() => setDeleteLeadId(lead.id)}
              />
            ))}

            {filteredLeads.length === 0 ? (
              <div className="grid place-items-center px-6 py-16 text-center">
                <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
                  <Search className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-black">Nenhum lead encontrado</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Ajuste os filtros ou cadastre um novo lead para continuar o atendimento.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      {selectedLead ? <LeadSidePanel lead={selectedLead} onClose={() => setSelectedLeadId(null)} /> : null}

      {deleteLeadId ? (
        <DeleteLeadModal
          lead={activeLeads.find((lead) => lead.id === deleteLeadId) ?? null}
          onCancel={() => setDeleteLeadId(null)}
          onConfirm={confirmDeleteLead}
        />
      ) : null}

      {showCreateModal ? (
        <LeadFormModal
          draft={draft}
          setDraft={setDraft}
          onClose={() => setShowCreateModal(false)}
          onSave={saveLead}
        />
      ) : null}
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  detail,
  tone,
  compact
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
  detail: string;
  tone: string;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_24px_70px_rgba(0,0,0,0.26)]",
        `bg-gradient-to-br ${tone} to-transparent`
      )}
    >
      <div className="absolute inset-x-4 bottom-3 h-8 rounded-full bg-primary/10 blur-2xl opacity-0 transition group-hover:opacity-70" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-primary">
          <Icon className="size-4" />
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-200">
          {trend}
        </span>
      </div>
      <p className={cn("relative mt-4 font-mono font-black tracking-tight", compact ? "text-xl" : "text-3xl")}>{value}</p>
      <p className="relative mt-1 text-xs font-bold text-foreground">{label}</p>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-cyan-300 transition duration-300 group-hover:w-5/6" />
      </div>
      <p className="relative mt-2 text-[11px] font-semibold text-muted-foreground">{detail}</p>
    </article>
  );
}

function LeadRow({
  lead,
  index,
  onOpen,
  onAskDelete
}: {
  lead: LeadRecord;
  index: number;
  onOpen: () => void;
  onAskDelete: () => void;
}) {
  const score = aiScore(lead);
  const pulse = pulseStatus(lead);
  const isHighScore = score >= 90;

  return (
    <article
      className={cn(
        "group relative grid gap-4 px-4 py-4 transition duration-300 hover:bg-white/[0.04] xl:grid-cols-[minmax(220px,1.35fr)_0.75fr_0.9fr_1.2fr_0.95fr_0.75fr_0.9fr_1fr_0.8fr] xl:items-center xl:gap-3",
        isHighScore && "bg-primary/[0.025] ring-1 ring-inset ring-primary/15"
      )}
      style={{ animation: `leadFadeIn 360ms ease ${index * 35}ms both` }}
    >
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <div className="flex min-w-0 items-start gap-3">
          <LeadInitialFrame lead={lead} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-black">{lead.name}</h3>
            </div>
            <div className="group/lead-preview relative mt-1">
              <p className="line-clamp-1 text-xs font-semibold text-muted-foreground">{lead.lastMessage}</p>
              <div className="pointer-events-none absolute left-0 top-5 z-30 w-[min(340px,calc(100vw-2rem))] translate-y-1 rounded-xl border border-white/10 bg-[#0b1120]/96 p-3 text-xs leading-5 text-slate-200 opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.44)] backdrop-blur-xl transition-all duration-200 group-hover/lead-preview:translate-y-0 group-hover/lead-preview:opacity-100">
                {lead.lastMessage}
              </div>
            </div>
          </div>
        </div>
      </button>

      <Cell label="Origem">
        <Badge className={originTone(lead.origin)}>{lead.origin}</Badge>
      </Cell>

      <Cell label="Etapa">
        <Badge className={stageTone(lead.status)}>{stageLabel(lead.status)}</Badge>
      </Cell>

      <Cell label="Direcionamento">
        <p className="line-clamp-2 text-xs font-bold leading-5 text-slate-100">{nextAction(lead)}</p>
      </Cell>

      <Cell label="Pulso Comercial">
        <div className="group/pulse relative inline-flex w-fit">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black", pulse.tone)}>
            <span className="text-xs leading-none">{pulse.icon}</span>
            {pulse.label}
          </span>
          <span className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-56 translate-y-1 rounded-xl border border-white/10 bg-[#0b1120]/98 p-3 text-xs font-semibold leading-5 text-slate-100 opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-all duration-200 group-hover/pulse:translate-y-0 group-hover/pulse:opacity-100">
            {pulse.tooltip}
          </span>
        </div>
      </Cell>

      <Cell label="Score IA">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-cyan-300" />
            <span className={cn("font-mono text-lg font-black", isHighScore ? "text-primary" : "text-slate-100")}>{score}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{intentText(lead)}</p>
        </div>
      </Cell>

      <Cell label="Ultimo Contato">
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black", timeTone(lead))}>
          <Clock3 className="size-3" />
          {lead.lastInteraction}
        </span>
      </Cell>

      <Cell label="Proxima Acao">
        <Badge className={nextActionTone(lead)}>{nextAction(lead)}</Badge>
      </Cell>

      <Cell label="Acoes">
        <div className="flex items-center justify-start gap-2">
          <div className="flex items-center gap-1">
            <QuickAction label="WhatsApp" icon={MessageCircle} href={`/conversas?lead=${lead.id}`} />
            <QuickAction label="Ligar" icon={PhoneCall} />
            <QuickAction label="Excluir lead" icon={Trash2} danger onClick={onAskDelete} />
          </div>
        </div>
      </Cell>
    </article>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground xl:hidden">{label}</p>
      {children}
    </div>
  );
}

function QuickAction({
  label,
  icon: Icon,
  href,
  danger,
  onClick
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "grid size-7 place-items-center rounded-lg border border-white/10 bg-white/[0.045] text-muted-foreground transition duration-200 hover:-translate-y-0.5",
    danger
      ? "hover:border-red-400/35 hover:bg-red-500/12 hover:text-red-300"
      : "hover:border-primary/30 hover:bg-primary/12 hover:text-primary"
  );

  if (href) {
    return (
      <Link href={href} className={className} title={label}>
        <Icon className="size-4" />
      </Link>
    );
  }

  return (
    <button type="button" className={className} title={label} onClick={onClick}>
      <Icon className="size-3.5" />
    </button>
  );
}

function DeleteLeadModal({
  lead,
  onCancel,
  onConfirm
}: {
  lead: LeadRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl border border-red-400/20 bg-card p-5 shadow-[0_28px_90px_rgba(0,0,0,0.52)]">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-500/12 text-red-300">
            <Trash2 className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">Excluir lead?</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Tem certeza que deseja excluir {lead?.name ? <strong className="text-foreground">{lead.name}</strong> : "este lead"}?
              Essa acao remove o lead da lista e do funil local.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            Nao
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-xl bg-red-500 px-4 text-sm font-extrabold text-white shadow-[0_0_26px_rgba(239,68,68,0.25)] transition hover:-translate-y-0.5 hover:bg-red-400"
          >
            Sim, excluir
          </button>
        </div>
      </section>
    </div>
  );
}

function LeadSidePanel({ lead, onClose }: { lead: LeadRecord; onClose: () => void }) {
  const score = aiScore(lead);
  const ai = aiStatusConfig[aiState(lead)];

  return (
    <div className="fixed inset-0 z-[140] flex justify-end bg-black/55 backdrop-blur-sm">
      <aside className="flex h-dvh w-full max-w-2xl flex-col overflow-hidden border-l border-white/10 bg-[#0b1422]/96 shadow-[0_30px_120px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1422]/92 p-5 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <LeadInitialFrame lead={lead} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-black">{lead.name}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="size-4" />
                {lead.phone}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={stageTone(lead.status)}>{stageLabel(lead.status)}</Badge>
                <Badge className={temperatureConfig[lead.temperature].tone}>{temperatureConfig[lead.temperature].label}</Badge>
                <Badge className={ai.tone}>
                  <span className={cn("mr-1.5 size-1.5 rounded-full", ai.dot)} />
                  {ai.label}
                </Badge>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-2xl text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="grid gap-4">
          <section className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-sm font-black">IA recomenda</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {intentText(lead)}. Proxima melhor acao: {nextAction(lead).toLowerCase()}.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <Insight label="Score IA" value={`${score}%`} icon={Bot} />
            <Insight label="Chance de matricula" value={`${Math.min(score + 6, 98)}%`} icon={Target} />
            <Insight label="Receita estimada" value={formatCurrency(Math.round(2100 * (score / 100)))} icon={TrendingUp} />
          </div>

          <DrawerSection title="Timeline operacional" subtitle="Historico resumido do lead" icon={Activity}>
            <div className="space-y-3">
              <TimelineItem title="Lead entrou no funil" detail={`${lead.origin} - ${lead.lastInteraction}`} />
              <TimelineItem title="IA identificou intencao" detail={intentText(lead)} />
              <TimelineItem title="Proxima acao" detail={nextAction(lead)} active />
            </div>
          </DrawerSection>

          <DrawerSection title="Dados comerciais" subtitle="Origem, responsavel e interesse" icon={Target} defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2">
              <PanelInfo label="Origem" value={lead.origin} icon={Target} />
              <PanelInfo label="Responsavel" value={lead.responsible} icon={UserRound} />
              <PanelInfo label="Interesse" value={`CNH ${lead.interest ?? "carro"}`} icon={Tag} />
              <PanelInfo label="Ultima interacao" value={lead.lastInteraction} icon={Clock3} />
            </div>
          </DrawerSection>

          <DrawerSection title="Observacoes" subtitle="Contexto completo sob demanda" icon={FileText}>
            <p className="text-sm leading-6 text-muted-foreground">{lead.notes}</p>
          </DrawerSection>

        </div>
        </div>

          <div className="grid gap-2 border-t border-white/10 bg-[#0b1422]/98 p-5 sm:grid-cols-2">
            <Link
              href={`/conversas?lead=${lead.id}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:-translate-y-0.5"
            >
              <MessageCircle className="size-4" />
              Abrir conversa
            </Link>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-extrabold text-muted-foreground transition hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-foreground">
              <CalendarPlus className="size-4" />
              Criar tarefa
            </button>
          </div>
      </aside>
    </div>
  );
}

function DrawerSection({
  title,
  subtitle,
  icon: Icon,
  defaultOpen = false,
  children
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-[14px] border border-primary/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.16),rgba(255,255,255,0.035))] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon className="size-4" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="mt-4 border-t border-white/[0.07] pt-4">{children}</div>
    </details>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black", className)}>{children}</span>;
}

function Insight({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <span className="grid size-9 place-items-center rounded-[14px] border border-primary/20 bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={1.9} />
      </span>
      <p className="mt-3 font-mono text-xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function TimelineItem({ title, detail, active }: { title: string; detail: string; active?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className={cn("mt-1 size-3 rounded-full border-2 border-card", active ? "bg-primary shadow-glow" : "bg-cyan-300")} />
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function PanelInfo({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <span className="grid size-10 place-items-center rounded-[14px] border border-primary/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.16),rgba(255,255,255,0.035))] text-primary">
        <Icon className="size-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-bold capitalize">{value}</p>
      </div>
    </div>
  );
}

function LeadFormModal({
  draft,
  setDraft,
  onClose,
  onSave
}: {
  draft: LeadDraft;
  setDraft: React.Dispatch<React.SetStateAction<LeadDraft>>;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-3xl border border-white/10 bg-card shadow-panel">
        <div className="flex items-start gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-lg font-extrabold">Novo lead</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre o lead para aparecer na base e no funil.</p>
          </div>
          <button onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nome">
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="kanban-input" placeholder="Nome do lead" />
          </Field>
          <Field label="WhatsApp">
            <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} className="kanban-input" placeholder="+55 75 99999-0000" />
          </Field>
          <Field label="Origem">
            <select value={draft.origin} onChange={(event) => setDraft((current) => ({ ...current, origin: event.target.value }))} className="kanban-input">
              {origins.map((origin) => (
                <option key={origin}>{origin}</option>
              ))}
            </select>
          </Field>
          <Field label="Etapa">
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as LeadStage }))} className="kanban-input">
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Temperatura">
            <select value={draft.temperature} onChange={(event) => setDraft((current) => ({ ...current, temperature: event.target.value as LeadRecord["temperature"] }))} className="kanban-input">
              <option value="quente">Quente</option>
              <option value="morno">Morno</option>
              <option value="frio">Frio</option>
              <option value="urgente">Urgente</option>
            </select>
          </Field>
          <Field label="Sentimento">
            <select value={draft.sentiment} onChange={(event) => setDraft((current) => ({ ...current, sentiment: event.target.value as LeadRecord["sentiment"] }))} className="kanban-input">
              <option value="positivo">Positivo</option>
              <option value="neutro">Neutro</option>
              <option value="duvida">Duvida</option>
              <option value="negativo">Negativo</option>
            </select>
          </Field>
          <Field label="Interesse">
            <select value={draft.interest} onChange={(event) => setDraft((current) => ({ ...current, interest: event.target.value as LeadInterest }))} className="kanban-input">
              <option value="carro">CNH B</option>
              <option value="moto">CNH A</option>
              <option value="adicao">Adicao de categoria</option>
              <option value="mudanca">Mudanca de categoria</option>
            </select>
          </Field>
          <Field label="Responsavel">
            <input value={draft.responsible} onChange={(event) => setDraft((current) => ({ ...current, responsible: event.target.value }))} className="kanban-input" />
          </Field>
          <Field label="Ultima mensagem" wide>
            <textarea value={draft.lastMessage} onChange={(event) => setDraft((current) => ({ ...current, lastMessage: event.target.value }))} className="kanban-input min-h-20 resize-none" />
          </Field>
          <Field label="Observacoes" wide>
            <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="kanban-input min-h-24 resize-none" />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 p-5">
          <button onClick={onClose} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            Cancelar
          </button>
          <button onClick={onSave} className="h-10 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:-translate-y-0.5">
            Salvar lead
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn("space-y-2", wide && "sm:col-span-2")}>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
