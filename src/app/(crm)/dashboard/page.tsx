"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  Bot,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Filter,
  Flame,
  Medal,
  MessageCircleMore,
  MessageCircle,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { dashboardStats } from "@/lib/mock-data";

const aiMetricIcons = [Bot, Target, Clock3, UserPlus];

const dashboardPeriods = ["Hoje", "Ontem", "Ultimos 7 dias", "Ultimos 15 dias", "Ultimos 30 dias", "Todo o periodo"];

type DashboardRuntimeMetrics = {
  stats: typeof dashboardStats;
  period?: {
    label: string;
    start: string | null;
    end: string | null;
  };
  thermometer: {
    total: number;
    items: Array<{ label: string; value: number }>;
  };
  leadsByOrigin: Array<{ label: string; value: number; percent?: number }>;
  sellerClosing: Array<{ seller: string; closed: number; revenue: string; conversion: number; position?: number; progress?: number }>;
  funnelData: Array<{ etapa: string; value: number }>;
  aiPerformance: Array<{ metric: string; value: number; detail: string }>;
  monthlyConversion: Array<{ month: string; leads: number; enrollments: number }>;
  commercialPulse: Array<{ label: string; time: string; kind: "enrollment" | "ai" | "hot" | "conversation" | "growth" }>;
};

type DashboardMetricsResponse = DashboardRuntimeMetrics & {
  ok?: boolean;
  error?: string;
};

function buildDashboardCards(stats: typeof dashboardStats) {
  const hasLeads = Number(stats.leadsHoje) > 0;
  const hasConversations = Number(stats.conversasAtivas) > 0;
  const hasEnrollments = Number(stats.matriculasFechadas) > 0;
  const hasAiConversations = Number(stats.iaAtendendo) > 0;
  const hasHotLeads = Number(stats.leadsQuentes) > 0;
  const hasSales = String(stats.vendasMes).replace(/\D/g, "") !== "0";
  const conversionDetail = hasLeads && hasEnrollments
    ? `${stats.taxaConversao}% de conversao`
    : "Aguardando dados";

  return [
  {
    label: "Leads Hoje",
    value: stats.leadsHoje,
    badge: "+12%",
    detail: hasLeads ? "Dados reais do periodo" : "Aguardando dados",
    icon: UserPlus,
    tone: "trust"
  },
  {
    label: "Conversas Ativas",
    value: stats.conversasAtivas,
    badge: "+5",
    detail: hasConversations ? "Conversas reais no periodo" : "Aguardando dados",
    icon: MessageCircle,
    tone: "tech"
  },
  {
    label: "Matriculas",
    value: stats.matriculasFechadas,
    badge: "+3",
    detail: conversionDetail,
    icon: Trophy,
    tone: "success"
  },
  {
    label: "Taxa Conversao",
    value: `${stats.taxaConversao}%`,
    badge: "+2.1%",
    detail: hasLeads && hasEnrollments ? "Calculada com leads reais" : "Aguardando dados",
    icon: TrendingUp,
    tone: "olive"
  },
  {
    label: "IA Atendendo",
    value: stats.iaAtendendo,
    badge: "ao vivo",
    detail: hasAiConversations ? "IA ativa em conversas reais" : "Aguardando dados",
    icon: Bot,
    tone: "gold"
  },
  {
    label: "Leads Quentes",
    value: stats.leadsQuentes,
    badge: "+4",
    detail: hasHotLeads ? "Prontos para prioridade comercial" : "Aguardando dados",
    icon: Flame,
    tone: "alert"
  },
  {
    label: "Tempo Resposta",
    value: stats.tempoMedioResposta,
    badge: "SLA",
    detail: hasConversations ? "SLA calculado pelo atendimento" : "Aguardando dados",
    icon: Clock3,
    tone: "slate"
  },
  {
    label: "Vendas do Mes",
    value: stats.vendasMes,
    badge: "+18%",
    detail: hasSales ? "Estimativa por matriculas reais" : "Aguardando dados",
    icon: CircleDollarSign,
    iconSize: 20,
    tone: "gold"
  }
  ];
}

const cardToneClasses: Record<string, { panel: string; icon: string }> = {
  trust: {
    panel: "border-sky-300/14 bg-[linear-gradient(135deg,rgba(11,95,165,0.10),rgba(17,24,39,0.82)_46%,rgba(11,17,32,0.96))]",
    icon: "border-sky-300/14 bg-sky-300/[0.055] text-sky-200/85"
  },
  tech: {
    panel: "border-slate-500/12 bg-[linear-gradient(135deg,rgba(31,41,55,0.42),rgba(17,24,39,0.88)_52%,rgba(11,17,32,0.96))]",
    icon: "border-slate-300/12 bg-slate-300/[0.045] text-slate-200/82"
  },
  success: {
    panel: "border-emerald-300/13 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(17,24,39,0.88)_50%,rgba(11,17,32,0.96))]",
    icon: "border-emerald-300/14 bg-emerald-300/[0.055] text-emerald-200/85"
  },
  olive: {
    panel: "border-yellow-300/13 bg-[linear-gradient(135deg,rgba(234,179,8,0.075),rgba(31,41,55,0.56)_48%,rgba(11,17,32,0.96))]",
    icon: "border-yellow-300/14 bg-yellow-300/[0.055] text-yellow-200/85"
  },
  alert: {
    panel: "border-red-300/12 bg-[linear-gradient(135deg,rgba(239,68,68,0.075),rgba(31,41,55,0.56)_48%,rgba(11,17,32,0.96))]",
    icon: "border-red-300/13 bg-red-300/[0.05] text-red-200/82"
  },
  slate: {
    panel: "border-slate-500/12 bg-[linear-gradient(135deg,rgba(51,65,85,0.38),rgba(17,24,39,0.9)_52%,rgba(11,17,32,0.96))]",
    icon: "border-slate-300/12 bg-slate-300/[0.045] text-slate-200/82"
  },
  gold: {
    panel: "border-yellow-300/13 bg-[linear-gradient(135deg,rgba(250,204,21,0.075),rgba(31,41,55,0.58)_48%,rgba(11,17,32,0.96))]",
    icon: "border-yellow-300/14 bg-yellow-300/[0.055] text-yellow-200/85"
  }
};

const interactivePanelClass =
  "rounded-[22px] border border-border bg-card/72 p-5 shadow-panel transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_30px_80px_oklch(0_0_0_/_0.42)]";

const chartSurfaceClass =
  "relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[radial-gradient(circle_at_78%_4%,rgba(250,204,21,0.14),transparent_32%),linear-gradient(145deg,rgba(17,24,39,0.78),rgba(11,17,32,0.9))] p-4";

const neutralChartSurfaceClass =
  "relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(17,24,39,0.78),rgba(11,17,32,0.92))] p-4";

const monthlyConversion = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map(
  (month) => ({ month, leads: 0, enrollments: 0 })
);

const designPalette = {
  yellow: "#FACC15",
  blue: "#0B5FA5",
  green: "#22C55E",
  graphite: "#1F2937"
};

const originDonutColors = [
  "#D7B21D",
  "#1A7F4B",
  "#0B5FA5",
  "#A88418",
  "#2B5F96",
  "#334155"
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function DashboardIcon({
  icon: Icon,
  tone,
  size = 18,
  className
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  tone?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[12px] border bg-white/[0.032] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_20px_rgba(0,0,0,0.14)] backdrop-blur-sm transition duration-300",
        tone ?? "border-[#FACC15]/24 text-[#FACC15]",
        className
      )}
    >
      <Icon size={size} strokeWidth={2.15} />
    </div>
  );
}

export default function DashboardPage() {
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("Hoje");
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);
  const [runtimeMetrics, setRuntimeMetrics] = useState<DashboardRuntimeMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const periodFilterCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displaySellers = useMemo(() => runtimeMetrics?.sellerClosing ?? [], [runtimeMetrics?.sellerClosing]);
  const rankedSellers = displaySellers.slice().sort((a, b) => b.closed - a.closed);
  const bestSeller = rankedSellers[0] ?? null;
  const displayStats = runtimeMetrics?.stats ?? dashboardStats;
  const displayOriginData = runtimeMetrics?.leadsByOrigin ?? [];
  const displayFunnelData = runtimeMetrics?.funnelData ?? [];
  const displayAiPerformance = runtimeMetrics?.aiPerformance ?? [];
  const displayMonthlyConversion = runtimeMetrics?.monthlyConversion ?? monthlyConversion;
  const displayCommercialPulse = runtimeMetrics?.commercialPulse ?? [];
  const cards = buildDashboardCards(displayStats);

  const cancelPeriodFilterClose = () => {
    if (periodFilterCloseTimer.current) {
      clearTimeout(periodFilterCloseTimer.current);
      periodFilterCloseTimer.current = null;
    }
  };

  const schedulePeriodFilterClose = () => {
    cancelPeriodFilterClose();
    periodFilterCloseTimer.current = setTimeout(() => {
      setPeriodFilterOpen(false);
      periodFilterCloseTimer.current = null;
    }, 220);
  };

  useEffect(() => {
    let active = true;

    async function loadMetrics() {
      try {
        const response = await fetch(`/api/dashboard/metrics?period=${encodeURIComponent(selectedPeriod)}`, { cache: "no-store" });
        const data = await response.json().catch(() => null) as DashboardMetricsResponse | null;

        if (!response.ok || !data || data.ok === false) {
          if (active) {
            setMetricsError(data?.error ?? `Nao foi possivel carregar metricas reais. Status ${response.status}.`);
          }
          return;
        }

        if (active) {
          setRuntimeMetrics({
            stats: data.stats,
            period: data.period,
            thermometer: data.thermometer,
            leadsByOrigin: data.leadsByOrigin ?? [],
            sellerClosing: data.sellerClosing ?? [],
            funnelData: data.funnelData ?? [],
            aiPerformance: data.aiPerformance ?? [],
            monthlyConversion: data.monthlyConversion ?? monthlyConversion,
            commercialPulse: data.commercialPulse ?? []
          });
          setMetricsError(null);
        }
      } catch (error) {
        console.warn("[dashboard] falha ao carregar metricas reais", error);
        if (active) {
          setMetricsError(error instanceof Error ? error.message : "Falha ao consultar metricas reais.");
        }
      }
    }

    loadMetrics();
    window.addEventListener("focus", loadMetrics);
    const interval = window.setInterval(loadMetrics, 5_000);

    return () => {
      active = false;
      window.removeEventListener("focus", loadMetrics);
      window.clearInterval(interval);
    };
  }, [selectedPeriod]);

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Numeros comerciais que mostram venda, velocidade e conversao"
        extraControls={
          <div className="relative" onMouseEnter={cancelPeriodFilterClose} onMouseLeave={schedulePeriodFilterClose}>
            <button
              type="button"
              onClick={() => setPeriodFilterOpen((open) => !open)}
              onMouseEnter={() => {
                cancelPeriodFilterClose();
                setPeriodFilterOpen(true);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#0B1120]/82 px-4 text-sm font-black text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-[#111827]"
              aria-label="Filtrar dados do dashboard"
            >
              <Filter className="size-4 text-primary" />
              <span className="hidden sm:inline">{selectedPeriod}</span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", periodFilterOpen && "rotate-180 text-primary")} />
            </button>

            {periodFilterOpen ? (
              <div
                className="absolute right-0 top-12 z-[140] w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1120]/[0.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl"
                onMouseEnter={cancelPeriodFilterClose}
                onMouseLeave={schedulePeriodFilterClose}
              >
                <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Periodo dos dados</p>
                <div className="grid gap-1">
                  {dashboardPeriods.map((period) => {
                    const active = selectedPeriod === period;

                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => {
                          setSelectedPeriod(period);
                          setPeriodFilterOpen(false);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold transition hover:bg-white/[0.06]",
                          active ? "bg-primary/14 text-primary" : "text-slate-200"
                        )}
                      >
                        <span>{period}</span>
                        {active ? <span className="size-1.5 rounded-full bg-primary shadow-[0_0_14px_rgba(250,204,21,0.75)]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        }
      />
      <main className="flex-1 space-y-6 overflow-y-auto bg-background p-6">
        {metricsError ? (
          <section className="rounded-2xl border border-red-400/25 bg-red-500/[0.08] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-red-300/25 bg-red-400/10 text-red-200">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-red-100">Metricas reais nao atualizaram</p>
                <p className="mt-1 text-xs leading-5 text-red-100/78">
                  {metricsError} Verifique o banco, permissao do usuario e os logs de <span className="font-mono">/api/dashboard/metrics</span>.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className={cn(
                "group relative min-h-[170px] cursor-pointer overflow-hidden rounded-[22px] border p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.005] hover:border-white/12 hover:shadow-[0_22px_58px_rgba(0,0,0,0.30)]",
                cardToneClasses[card.tone].panel
              )}
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="flex h-full flex-col justify-between">
                <DashboardIcon icon={card.icon} tone={cardToneClasses[card.tone].icon} size={card.iconSize ?? 18} />

                <div>
                  <p className="font-mono text-[2rem] font-black leading-none tracking-tight text-primary md:text-[2.1rem]">{card.value}</p>
                  <p className="mt-2 text-sm font-black text-foreground">{card.label}</p>
                  <p className="mt-1 text-xs font-medium text-slate-300/78">{card.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <article className={cn(interactivePanelClass, "flex h-full flex-col self-stretch")}>
            <div className="mb-5">
              <h2 className="text-lg font-extrabold tracking-normal">Conversao Mensal</h2>
              <p className="mt-1 text-sm text-muted-foreground">Leads vs Matriculas</p>
            </div>
            <MonthlyConversionChart data={displayMonthlyConversion} />
          </article>

          <div className="grid h-full gap-6 xl:grid-rows-2">
            <BusinessPulsePanel compact events={displayCommercialPulse} />
            <article className={cn(interactivePanelClass, "flex h-full flex-col self-stretch p-4")}>
              <div className="mb-3">
                <h2 className="text-base font-extrabold tracking-normal">Leads por Origem</h2>
                <p className="mt-1 text-xs text-muted-foreground">Ultimos 30 dias</p>
              </div>
              <OriginDonut compact data={displayOriginData} funnelData={displayFunnelData} />
            </article>
          </div>
        </section>

        <div className="relative -my-1 h-4">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent" />
          <button
            type="button"
            onClick={() => setSecondaryExpanded((value) => !value)}
            className="absolute left-1/2 top-1/2 z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-white/10 bg-[#0b1120]/95 text-muted-foreground shadow-[0_12px_34px_rgba(0,0,0,0.32)] transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
            aria-label={secondaryExpanded ? "Recolher graficos secundarios" : "Expandir graficos secundarios"}
          >
            <ChevronDown className={cn("size-4 transition-transform", !secondaryExpanded && "-rotate-90")} />
          </button>
        </div>

        {secondaryExpanded ? (
        <section className="mt-3 grid items-stretch gap-6 xl:grid-cols-2">
          <article className="group relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[radial-gradient(circle_at_82%_0%,rgba(11,95,165,0.16),transparent_34%),linear-gradient(145deg,rgba(17,24,39,0.92),rgba(11,17,32,0.98))] p-5 shadow-panel transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#0B5FA5]/45 to-transparent opacity-70" />
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary/80">Ranking comercial</p>
                <h2 className="text-lg font-extrabold tracking-normal">Vendedor com mais fechamento</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bestSeller ? `${bestSeller.seller} lidera a disputa com ${bestSeller.closed} matriculas no mes` : "Aguardando fechamentos reais no periodo"}
                </p>
              </div>
              <div className="group/ranking-hint relative shrink-0">
                <DashboardIcon icon={Trophy} tone="border-[#FACC15]/28 bg-[#FACC15]/10 text-[#FACC15]" size={20} />
                <div className="pointer-events-none absolute right-0 top-12 z-30 w-64 translate-y-2 rounded-2xl border border-white/10 bg-[#0B1120]/[0.98] p-3 text-left opacity-0 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 group-hover/ranking-hint:translate-y-0 group-hover/ranking-hint:opacity-100">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">Destaque comercial</p>
                  <p className="mt-2 text-sm font-bold text-foreground">
                    {bestSeller ? `${bestSeller.seller} lidera o ranking de fechamento.` : "Sem fechamentos registrados ainda."}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Use este bloco para comparar produtividade, receita e ritmo de matriculas por vendedor.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4 grid h-[214px] grid-cols-3 items-end gap-3 rounded-2xl border border-white/[0.06] bg-[#0B1120]/38 px-4 pb-4 pt-8">
              {[rankedSellers[1], rankedSellers[0], rankedSellers[2]].filter(Boolean).map((seller, podiumIndex) => {
                const position = podiumIndex === 0 ? 2 : podiumIndex === 1 ? 1 : 3;
                const PodiumIcon = position === 1 ? Trophy : Medal;
                const height = position === 1 ? "h-[172px]" : position === 2 ? "h-[134px]" : "h-[118px]";
                const tone =
                  position === 1
                    ? "border-[#FACC15]/46 bg-[linear-gradient(180deg,rgba(250,204,21,0.20),rgba(17,24,39,0.84))]"
                    : position === 2
                      ? "border-slate-200/28 bg-[linear-gradient(180deg,rgba(226,232,240,0.16),rgba(17,24,39,0.84))]"
                      : "border-[#0B5FA5]/38 bg-[linear-gradient(180deg,rgba(11,95,165,0.22),rgba(17,24,39,0.84))]";
                const iconTone =
                  position === 1
                    ? "border-[#FACC15]/38 bg-[linear-gradient(145deg,rgba(250,204,21,0.22),rgba(17,24,39,0.92))] text-[#FACC15]"
                    : position === 2
                      ? "border-slate-200/30 bg-[linear-gradient(145deg,rgba(226,232,240,0.18),rgba(17,24,39,0.92))] text-slate-100"
                      : "border-[#0B5FA5]/34 bg-[linear-gradient(145deg,rgba(11,95,165,0.18),rgba(17,24,39,0.92))] text-[#CD7F32]";

                return (
                  <div
                    key={seller.seller}
                    className={cn(
                      "relative flex flex-col items-center overflow-visible rounded-2xl border px-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_16px_34px_rgba(0,0,0,0.22)]",
                      position === 1 ? "justify-center pb-1 pt-7" : "justify-end pb-3 pt-6",
                      height,
                      tone
                    )}
                  >
                    <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div className={cn("absolute -top-6 z-20 grid size-12 place-items-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_30px_rgba(0,0,0,0.34)] backdrop-blur", iconTone)}>
                      <PodiumIcon className="size-5" strokeWidth={2.1} />
                    </div>
                    <p className="w-full truncate text-sm font-black">{seller.seller}</p>
                    <p className="mt-2 font-mono text-2xl font-black text-foreground">{seller.closed}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">matriculas</p>
                  </div>
                );
              })}
            </div>

            <div className="grid max-h-[204px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 [scrollbar-color:rgba(11,95,165,0.45)_transparent] [scrollbar-width:thin]">
              {rankedSellers.length ? rankedSellers.map((seller, index) => (
                <SellerRow key={seller.seller} seller={seller} position={index + 1} maxClosed={Math.max(1, ...rankedSellers.map((item) => item.closed))} />
              )) : (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm font-bold text-muted-foreground md:col-span-2">
                  Nenhum vendedor com fechamento real neste periodo.
                </div>
              )}
            </div>
          </article>

          <ChartPanel
            title="Desempenho da IA"
            subtitle="Qualidade e velocidade do atendimento automatico"
            icon={Bot}
          >
            <div className="grid gap-3">
              {displayAiPerformance.length ? displayAiPerformance.map((item, index) => {
                const MetricIcon = aiMetricIcons[index] ?? Bot;

                return (
                <div
                  key={item.metric}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(11,95,165,0.14),rgba(17,24,39,0.88))] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0B5FA5]/45 hover:bg-[linear-gradient(135deg,rgba(11,95,165,0.20),rgba(17,24,39,0.94))] hover:shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
                >
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/30 to-transparent" />
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <DashboardIcon
                        icon={MetricIcon}
                        tone="border-[#0B5FA5]/28 bg-[#0B5FA5]/12 text-blue-100"
                        size={15}
                        className="size-9 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="font-extrabold">{item.metric}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                    <span className="rounded-xl border border-[#0B5FA5]/35 bg-[#0B5FA5]/18 px-2 py-1 font-mono text-lg font-black text-blue-100">
                      {item.value}%
                    </span>
                  </div>
                  <Meter percent={item.value} />
                  <Tooltip>
                    {item.metric}: {item.value}% - {item.detail}
                  </Tooltip>
                </div>
                );
              }) : (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm font-bold text-muted-foreground">
                  Aguardando metricas reais da IA comercial.
                </div>
              )}
            </div>
          </ChartPanel>
        </section>
        ) : null}
      </main>
    </>
  );
}

function BusinessPulsePanel({
  compact = false,
  events
}: {
  compact?: boolean;
  events: DashboardRuntimeMetrics["commercialPulse"];
}) {
  const visibleEvents = compact ? events.slice(0, 3) : events;
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);
  const eventIcons = {
    enrollment: Trophy,
    ai: Bot,
    hot: Flame,
    conversation: MessageCircleMore,
    growth: TrendingUp
  };

  return (
    <article className="relative isolate flex h-full min-h-0 flex-col self-stretch overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(17,24,39,0.86),rgba(11,17,32,0.96))] p-5 shadow-panel transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_58px_rgba(0,0,0,0.30)]">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      {showHealthTooltip ? (
        <div className="pointer-events-none absolute right-4 top-4 z-[80] w-[min(310px,calc(100%-2rem))] rounded-2xl border border-primary/25 bg-[#050914] p-4 text-left shadow-[0_30px_90px_rgba(0,0,0,0.86),0_0_0_1px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-black/90">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-primary">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]" />
              Saude comercial
            </span>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2 py-0.5 text-[10px] font-black text-emerald-200">
              87%
            </span>
          </div>
          <p className="text-xs font-black leading-5 text-white">Operacao saudavel e em aceleracao</p>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-300">
            IA: matriculas e qualificacoes estao subindo agora. Priorize os leads quentes e mantenha o follow-up ativo para nao perder conversao.
          </p>
        </div>
      ) : null}

      <div className={cn("relative z-10 flex items-start justify-between gap-4", compact ? "mb-4" : "mb-6")}>
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.10)]">
            <span className="size-1.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.95)]" />
            IA Ativa
          </div>
          <h2 className="text-lg font-extrabold tracking-normal">Pulso Comercial</h2>
          <p className="mt-1 text-sm text-muted-foreground">{compact ? "Eventos prioritarios agora" : "Eventos comerciais em tempo real"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="relative z-30 grid size-12 place-items-center rounded-[14px] border border-sky-300/20 bg-sky-300/8 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur-sm"
            onMouseEnter={() => setShowHealthTooltip(true)}
            onMouseLeave={() => setShowHealthTooltip(false)}
          >
            <PulseHealthIcon />
          </div>
        </div>
      </div>

      <div className={cn("relative z-0 min-h-0", compact ? "space-y-2.5 overflow-hidden" : "space-y-3")}>
        {visibleEvents.length ? visibleEvents.map((event, index) => (
          <div
            key={event.label}
            className={cn(
              "group relative grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.028] transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.055] hover:shadow-[0_18px_44px_rgba(0,0,0,0.22)]",
              compact ? "p-2" : "p-2.5"
            )}
          >
            <DashboardIcon
              icon={eventIcons[event.kind] ?? MessageCircleMore}
              tone="border-sky-300/18 bg-sky-300/8 text-sky-100 group-hover:border-sky-300/32 group-hover:bg-sky-300/12"
              size={15}
              className="relative z-10 size-8 rounded-[10px]"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{event.label}</p>
              <p className={cn("mt-0.5 text-[11px] font-semibold text-muted-foreground", compact && "hidden 2xl:block")}>
                {index === 0 ? "Evento confirmado no funil" : "Sincronizado com IA comercial"}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-background/40 px-2 py-1 text-[10px] font-black text-primary">
              {event.time}
            </span>
            <Tooltip>{event.time} - evento comercial em tempo real</Tooltip>
          </div>
        )) : (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.028] p-4 text-sm font-bold text-muted-foreground">
            Aguardando eventos reais do WhatsApp e do funil comercial.
          </div>
        )}
      </div>
    </article>
  );
}

function FunnelHealthDonut() {
  const data: Array<{ label: string; value: number; color: string }> = [];
  const rawTotal = data.reduce((sum, item) => sum + item.value, 0);
  const total = Math.max(1, rawTotal);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <article className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(17,24,39,0.86),rgba(11,17,32,0.96))] p-5 shadow-panel transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_58px_rgba(0,0,0,0.30)]">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/18 to-transparent" />
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-normal">Leads por Origem</h2>
          <p className="mt-1 text-sm text-muted-foreground">Canais que mais captam leads</p>
        </div>
        <div className="group/origin-hint relative shrink-0">
          <DashboardIcon icon={UserPlus} tone="border-sky-300/18 bg-sky-300/8 text-sky-100" size={19} />
          <div className="pointer-events-none absolute right-0 top-12 z-30 w-64 translate-y-2 rounded-2xl border border-white/10 bg-[#0B1120]/[0.98] p-3 text-left opacity-0 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 group-hover/origin-hint:translate-y-0 group-hover/origin-hint:opacity-100">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">Leads por origem</p>
            <p className="mt-2 text-sm font-bold text-foreground">{rawTotal} leads captados nos canais ativos.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Compare volume por canal e acompanhe onde vale concentrar investimento e atendimento.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 items-center gap-4 md:grid-cols-[150px_1fr] xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
        <div className="relative mx-auto grid size-[150px] place-items-center">
          <svg viewBox="0 0 120 120" className="size-[150px] -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(249,250,251,0.055)" strokeWidth="13" />
            {data.map((item) => {
              const dash = (item.value / total) * circumference;
              const offset = -accumulated * circumference;
              accumulated += item.value / total;

              return (
                <circle
                  key={item.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="13"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  className="transition-all duration-300 hover:opacity-80"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
              <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Total</span>
              <span className="block font-mono text-3xl font-black text-primary">{rawTotal}</span>
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          {data.length ? data.map((item) => (
            <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.028] px-3 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-xs font-black">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-mono text-xs font-black text-slate-200">{Math.round((item.value / total) * 100)}%</span>
            </div>
          )) : (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.028] px-3 py-4 text-xs font-bold text-muted-foreground">
              Sem origens reais no periodo.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CarPulseIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <UserPlus size={size} className={className} />;
}

function PulseHealthIcon() {
  return (
    <svg viewBox="0 0 44 44" className="size-9 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="businessPulseGradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.12" />
          <stop offset="42%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="businessPulseGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M5 23 H13 L17 14 L22 31 L27 20 L31 23 H39"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 23 H13 L17 14 L22 31 L27 20 L31 23 H39"
        fill="none"
        stroke="url(#businessPulseGradient)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#businessPulseGlow)"
        className="business-pulse-line"
      />
    </svg>
  );
}

function SellerRow({
  seller,
  position,
  maxClosed
}: {
  seller: { seller: string; closed: number; revenue: string; conversion: number };
  position: number;
  maxClosed: number;
}) {
  const progress = Math.round((seller.closed / maxClosed) * 100);
  const RankIcon = position === 1 ? Trophy : Medal;
  const rankTone =
    position === 1
      ? "border-[#FACC15]/45 bg-[#FACC15]/14 text-[#FACC15]"
      : position === 2
        ? "border-[#0B5FA5]/40 bg-[#0B5FA5]/16 text-blue-100"
        : position === 3
          ? "border-white/16 bg-white/[0.055] text-slate-200"
          : "border-white/10 bg-white/[0.04] text-muted-foreground";
  const barTone =
    position === 1
      ? "from-[#FACC15] via-[#EAB308] to-[#22C55E]"
      : position === 2
        ? "from-[#0B5FA5] via-blue-400 to-[#22C55E]"
        : position === 3
          ? "from-slate-500 via-slate-300 to-[#FACC15]"
          : "from-[#1F2937] via-[#0B5FA5] to-[#22C55E]";

  return (
    <div className="group relative overflow-visible rounded-2xl border border-white/[0.075] bg-[linear-gradient(135deg,rgba(31,41,55,0.72),rgba(11,17,32,0.86))] p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0B5FA5]/35 hover:bg-[linear-gradient(135deg,rgba(11,95,165,0.14),rgba(11,17,32,0.92))] hover:shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-[#0B5FA5]/55 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-center gap-2.5">
        <div className={cn("grid size-9 place-items-center rounded-xl border font-mono text-xs font-black", rankTone)}>
          {position <= 3 ? <RankIcon className="size-4" strokeWidth={2.1} /> : `#${position}`}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-foreground">{seller.seller}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{seller.conversion}% conversao</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-black text-foreground">{seller.closed}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">fech.</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="h-2 overflow-hidden rounded-full border border-white/[0.06] bg-[#0B1120]">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", barTone)}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-black text-blue-100">{progress}%</span>
      </div>
    </div>
  );
}

function MonthlyConversionChart({ data }: { data: Array<{ month: string; leads: number; enrollments: number }> }) {
  const chartData = data.length ? data : monthlyConversion;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, chartData.length - 1));
  const [isHovering, setIsHovering] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState({ leads: true, enrollments: true });
  const safeActiveIndex = Math.min(activeIndex, chartData.length - 1);

  useEffect(() => {
    setActiveIndex(Math.max(0, chartData.length - 1));
  }, [chartData.length]);
  const maxLeads = Math.max(1, ...chartData.map((item) => item.leads));
  const maxEnrollments = Math.max(1, ...chartData.map((item) => item.enrollments));
  const plotStart = 54;
  const plotEnd = 566;
  const plotBottom = 218;
  const plotHeight = 178;
  const xStep = (plotEnd - plotStart) / Math.max(chartData.length - 1, 1);
  const points = chartData.map((item, index) => {
    const x = plotStart + index * xStep;
    const yLeads = plotBottom - (item.leads / maxLeads) * plotHeight;
    const yEnrollments = plotBottom - (item.enrollments / maxEnrollments) * 142;
    const rate = item.leads > 0 ? Math.round((item.enrollments / item.leads) * 1000) / 10 : 0;
    const yRate = plotBottom - (rate / 38) * 132;

    return { ...item, x, yLeads, yEnrollments, yRate, rate };
  });
  const active = points[safeActiveIndex];
  const previous = points[safeActiveIndex - 1];
  const conversionRate = active.rate;
  const variation = previous ? active.enrollments - previous.enrollments : 0;
  const rateVariation = previous ? Math.round((active.rate - previous.rate) * 10) / 10 : 0;
  const bestMonth = points.reduce((best, point) => (point.rate > best.rate ? point : best), points[0]);
  const totalLeads = chartData.reduce((sum, item) => sum + item.leads, 0);
  const totalEnrollments = chartData.reduce((sum, item) => sum + item.enrollments, 0);
  const totalRate = totalLeads > 0 ? Math.round((totalEnrollments / totalLeads) * 1000) / 10 : 0;

  const leadLine = points.map((point) => `${point.x},${point.yLeads}`).join(" ");
  const enrollmentLine = points.map((point) => `${point.x},${point.yEnrollments}`).join(" ");
  const rateLine = points.map((point) => `${point.x},${point.yRate}`).join(" ");
  const leadArea = `${plotStart},${plotBottom} ${leadLine} ${plotEnd},${plotBottom}`;
  const enrollmentArea = `${plotStart},${plotBottom} ${enrollmentLine} ${plotEnd},${plotBottom}`;

  return (
    <div className={chartSurfaceClass}>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="grid gap-3 sm:grid-cols-3">
          <ChartStat label="Leads" value={String(totalLeads)} detail="12 meses" />
          <ChartStat label="Matriculas" value={String(totalEnrollments)} detail={`${totalRate}% conversao`} />
          <ChartStat label="Melhor mes" value={bestMonth.month} detail={`${bestMonth.rate}% conversao`} />
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link
            href="/relatorios"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground shadow-glow transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
          >
            Abrir relatorios
          </Link>
          <SeriesButton
            active={visibleSeries.leads}
            label="Leads"
            color="bg-primary"
            onClick={() => setVisibleSeries((current) => ({ ...current, leads: !current.leads }))}
          />
          <SeriesButton
            active={visibleSeries.enrollments}
            label="Matriculas"
            color="bg-success"
            onClick={() => setVisibleSeries((current) => ({ ...current, enrollments: !current.enrollments }))}
          />
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 600 260"
          className="h-[450px] w-full select-none"
          onMouseMove={(event) => {
            setIsHovering(true);
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 600;
            const nearestIndex = points.reduce((nearest, point, index) => {
              return Math.abs(point.x - x) < Math.abs(points[nearest].x - x) ? index : nearest;
            }, 0);

            setActiveIndex(nearestIndex);
          }}
          onMouseLeave={() => setIsHovering(false)}
        >
          <defs>
            <linearGradient id="leadStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
            <linearGradient id="enrollmentStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
            <linearGradient id="rateStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <filter id="chartGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 90, 180, 270, 360].map((tick) => {
            const y = 218 - (tick / 360) * 178;
            return (
              <g key={tick}>
                <line x1="54" x2="566" y1={y} y2={y} stroke="oklch(1 0 0 / 0.07)" strokeDasharray="4 6" />
                <text x="18" y={y + 4} fill="oklch(0.76 0.025 250)" fontSize="11">
                {Math.round((tick / 360) * maxLeads)}
                </text>
              </g>
            );
          })}

          <line x1="54" x2="566" y1="218" y2="218" stroke="oklch(0.76 0.025 250 / 0.34)" />
          <line x1="54" x2="54" y1="28" y2="218" stroke="oklch(0.76 0.025 250 / 0.34)" />

          {points.map((point, index) => {
            const barHeight = Math.max(10, (point.rate / 35) * 112);
            return (
              <g key={`bar-${point.month}`}>
                <rect
              x={point.x - 12}
              y={218 - barHeight}
              width="24"
                  height={barHeight}
                  rx="10"
                  fill={activeIndex === index ? "oklch(0.86 0.17 95 / 0.18)" : "oklch(1 0 0 / 0.045)"}
                  stroke={activeIndex === index ? "oklch(0.86 0.17 95 / 0.34)" : "oklch(1 0 0 / 0.05)"}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {visibleSeries.leads ? <polygon points={leadArea} fill="oklch(0.86 0.17 95 / 0.13)" /> : null}
          {visibleSeries.enrollments ? <polygon points={enrollmentArea} fill="oklch(0.70 0.18 145 / 0.12)" /> : null}
          {visibleSeries.leads ? (
            <polyline points={leadLine} fill="none" stroke="url(#leadStroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#chartGlow)" className="transition-all duration-300" />
          ) : null}
          {visibleSeries.enrollments ? (
            <polyline points={enrollmentLine} fill="none" stroke="url(#enrollmentStroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#chartGlow)" className="transition-all duration-300" />
          ) : null}
          <polyline points={rateLine} fill="none" stroke="url(#rateStroke)" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />

          <line x1={active.x} x2={active.x} y1="28" y2="218" stroke="oklch(0.96 0.01 95 / 0.45)" strokeDasharray="5 7" />

          {points.map((point, index) => (
            <g key={point.month}>
              <rect
                x={point.x - 22}
                y="28"
                width="44"
                height="206"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setIsHovering(true);
                }}
              />
              <text x={point.x} y="246" textAnchor="middle" fill={activeIndex === index ? "#facc15" : "oklch(0.76 0.025 250)"} fontSize="10" fontWeight={activeIndex === index ? "800" : "500"}>
                {point.month}
              </text>
              {visibleSeries.leads ? (
                <circle
                  cx={point.x}
                  cy={point.yLeads}
                  r={activeIndex === index ? "7" : "4"}
                  fill="#facc15"
                  stroke="#fff7cc"
                  strokeWidth={activeIndex === index ? "3" : "1"}
                  className="transition-all duration-200"
                />
              ) : null}
              {visibleSeries.enrollments ? (
                <circle
                  cx={point.x}
                  cy={point.yEnrollments}
                  r={activeIndex === index ? "7" : "4"}
                  fill="#22c55e"
                  stroke="#dcfce7"
                  strokeWidth={activeIndex === index ? "3" : "1"}
                  className="transition-all duration-200"
                />
              ) : null}
            </g>
          ))}
        </svg>

        <div
          className={cn(
            "pointer-events-none absolute min-w-[190px] rounded-2xl border border-white/10 bg-[#08111f]/95 px-4 py-3 shadow-[0_24px_70px_oklch(0_0_0_/_0.44)] backdrop-blur-xl transition-all duration-300 ease-out",
            isHovering ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
          style={{
            left: `min(calc(${(active.x / 600) * 100}% + 10px), calc(100% - 210px))`,
            top: `${Math.max(Math.min(active.yLeads, active.yEnrollments) - 36, 18)}px`
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-black">{active.month}</p>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
              {conversionRate}%
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-xs">
            <TooltipMetric color="bg-primary" label="Leads" value={active.leads} />
            <TooltipMetric color="bg-success" label="Matriculas" value={active.enrollments} />
            <TooltipMetric color="bg-blue-400" label="Conversao" value={`${conversionRate}%`} />
          </div>
          <p className={cn("mt-3 rounded-xl px-2 py-1 text-xs font-black", variation >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
            {variation >= 0 ? "+" : ""}
            {variation} matriculas vs mes anterior / {rateVariation >= 0 ? "+" : ""}
            {rateVariation}%
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2 pb-1 sm:grid-cols-12">
        {points.map((point, index) => (
          <button
            key={point.month}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              setIsHovering(true);
            }}
            className={cn(
              "min-w-0 rounded-xl border px-2 py-2 text-xs font-black transition duration-200 hover:-translate-y-0.5",
              activeIndex === index
                ? "border-primary/45 bg-primary text-primary-foreground shadow-glow"
                : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.065] hover:text-foreground"
            )}
          >
            {point.month}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChartStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-black">{value}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function SeriesButton({
  active,
  label,
  color,
  onClick
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition duration-200 hover:-translate-y-0.5",
        active
          ? "border-white/14 bg-white/[0.075] text-foreground"
          : "border-white/8 bg-white/[0.025] text-muted-foreground opacity-70"
      )}
    >
      <span className={cn("size-2.5 rounded-full", color)} />
      {label}
    </button>
  );
}

function TooltipMetric({ color, label, value }: { color: string; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className={cn("size-2 rounded-full", color)} />
        {label}
      </span>
      <span className="font-mono font-black text-foreground">{value}</span>
    </div>
  );
}


function OriginDonut({
  compact = false,
  data,
  funnelData
}: {
  compact?: boolean;
  data: Array<{ label: string; value: number; percent?: number }>;
  funnelData: Array<{ etapa: string; value: number }>;
}) {
  const [activeOrigin, setActiveOrigin] = useState<number | null>(null);
  const [activeFunnel, setActiveFunnel] = useState<number | null>(null);
  const rawTotal = data.reduce((sum, item) => sum + item.value, 0);
  const total = Math.max(1, rawTotal);
  const activeOriginData = activeOrigin !== null ? data[activeOrigin] : null;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const funnelMax = Math.max(1, ...funnelData.map((item) => item.value));
  const funnelColors = [
    ["#38BDF8", "#0B5FA5"],
    ["#FACC15", "#EAB308"],
    ["#64748B", "#1F2937"],
    ["#0B5FA5", "#111827"],
    ["#334155", "#0B1120"]
  ];
  let accumulated = 0;

  return (
    <div className={cn(neutralChartSurfaceClass, "flex h-full flex-col justify-between gap-3 bg-[linear-gradient(145deg,rgba(17,24,39,0.86),rgba(11,17,32,0.96))]", compact ? "min-h-0 p-3" : "min-h-[260px]")}>
      <div className={cn("grid items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3", compact ? "grid-cols-[112px_1fr]" : "sm:grid-cols-[minmax(150px,1fr)_minmax(104px,0.74fr)]")}>
        <div className={cn("relative mx-auto grid place-items-center", compact ? "size-28" : "size-44")}>
          <svg viewBox="0 0 120 120" className={cn("-rotate-90", compact ? "size-28" : "size-44")}>
          <defs>
            <filter id="originGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(249,250,251,0.055)" strokeWidth="13" />
          {data.map((origin, index) => {
              const percent = origin.value / total;
              const dash = percent * circumference;
              const offset = -accumulated * circumference;
              accumulated += percent;
            const isActive = activeOrigin === index;

            return (
                <circle
                  key={origin.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={originDonutColors[index]}
                  strokeWidth={isActive ? "16" : "13"}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  opacity={activeOrigin === null || isActive ? 1 : 0.52}
                  filter={isActive ? "url(#originGlow)" : undefined}
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setActiveOrigin(index)}
                  onMouseLeave={() => setActiveOrigin(null)}
                  onClick={() => setActiveOrigin((current) => (current === index ? null : index))}
                />
            );
          })}
        </svg>

          <div className="absolute inset-0 grid place-items-center">
            <div className={cn("grid place-items-center rounded-full border border-[#0B5FA5]/20 bg-[#0b1120]/95 text-center shadow-[inset_0_0_28px_rgba(0,0,0,0.35)]", compact ? "size-[64px]" : "size-[82px]")}>
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Total</span>
                <span className={cn("block font-mono font-black text-primary", compact ? "text-xl" : "text-2xl")}>{rawTotal}</span>
              </span>
            </div>
          </div>
          {activeOriginData ? (
            <div className={cn(
              "pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[82%] rounded-xl border border-white/10 bg-[#0B1120]/[0.98] px-3 py-2 text-center shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl",
              compact ? "min-w-[132px]" : "min-w-[156px]"
            )}>
              <p className="font-mono text-sm font-black text-primary">{activeOriginData.value} leads</p>
              <p className="mt-0.5 truncate text-[11px] font-bold text-slate-200">da {activeOriginData.label}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          {data.length ? data.map((origin, index) => {
            const percent = Math.round((origin.value / total) * 100);
            const isActive = activeOrigin === index;

            return (
              <button
                key={origin.label}
                type="button"
                onMouseEnter={() => setActiveOrigin(index)}
                onMouseLeave={() => setActiveOrigin(null)}
                onClick={() => setActiveOrigin((current) => (current === index ? null : index))}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl border px-2 text-left transition duration-300 hover:-translate-y-0.5",
                  compact ? "py-1" : "py-1.5",
                  isActive
                    ? "border-[#FACC15]/35 bg-[#FACC15]/10 shadow-[0_18px_44px_rgba(0,0,0,0.26)]"
                    : "border-white/[0.08] bg-[#111827]/58 hover:border-[#0B5FA5]/35 hover:bg-[#0B5FA5]/10"
                )}
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-black">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: originDonutColors[index] }} />
                  <span className="truncate">{origin.label}</span>
                </span>
                <span className="font-mono text-xs font-black text-foreground">{percent}%</span>
              </button>
            );
          }) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[11px] font-bold text-muted-foreground">
              Sem origens reais no periodo.
            </div>
          )}
        </div>
      </div>

      {compact ? null : (
      <div className="flex flex-1 flex-col justify-end rounded-2xl border border-[#0B5FA5]/18 bg-[linear-gradient(135deg,rgba(11,95,165,0.08),rgba(17,24,39,0.72))] p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-foreground">Funil de conversao</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">De novo lead ate matricula fechada</p>
          </div>
        </div>

        <div className="grid gap-2">
          {funnelData.length ? funnelData.map((item, index) => {
            const percent = Math.round((item.value / funnelMax) * 100);
            const funnelWidth = Math.max(26, 100 - index * 14);
            const isActive = activeFunnel === index;

            return (
              <button
                key={item.etapa}
                type="button"
                onMouseEnter={() => setActiveFunnel(index)}
                onMouseLeave={() => setActiveFunnel(null)}
                className="group/funnel rounded-xl border border-white/[0.08] bg-[#0B1120]/42 px-2.5 py-2 text-left transition duration-250 hover:border-white/[0.16] hover:bg-[#111827]/72"
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black text-foreground">{item.etapa}</span>
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">{item.value}</span>
                </div>
                <div className="relative h-7 overflow-hidden rounded-lg bg-white/[0.045]">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-1/2 grid -translate-x-1/2 place-items-center text-[10px] font-black text-[#0B1120] transition-all duration-300",
                      isActive && "brightness-110"
                    )}
                    style={{
                      width: `${funnelWidth}%`,
                      background: `linear-gradient(90deg, ${funnelColors[index][0]}, ${funnelColors[index][1]})`,
                      boxShadow: isActive ? `0 14px 34px color-mix(in srgb, ${funnelColors[index][0]} 22%, transparent)` : "inset 0 1px 0 rgba(255,255,255,0.16)",
                      clipPath: "polygon(4% 0, 96% 0, 90% 100%, 10% 100%)",
                      borderRadius: "8px"
                    }}
                  >
                    {percent}%
                  </div>
                </div>
              </button>
            );
          }) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-4 text-xs font-bold text-muted-foreground">
              Sem dados reais de funil ainda.
            </div>
          )}
          </div>
      </div>
      )}
    </div>
  );
}

function ChartPanel(props: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <article className={interactivePanelClass}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{props.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
        </div>
        <DashboardIcon icon={props.icon} tone="border-sky-300/20 bg-sky-300/10 text-sky-100" size={20} />
      </div>
      {props.children}
    </article>
  );
}

function Meter({ percent }: { percent: number }) {
  return (
    <div className="relative h-3 overflow-hidden rounded-full border border-white/[0.06] bg-[#0B1120]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#0B5FA5] via-[#22C55E] to-[#FACC15] shadow-[0_0_18px_rgba(11,95,165,0.20)]"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)] opacity-40" />
    </div>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 z-20 hidden max-w-[260px] -translate-y-1/2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-panel group-hover:block">
      {children}
    </div>
  );
}
