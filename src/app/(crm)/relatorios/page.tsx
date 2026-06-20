"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Filter,
  LineChart,
  MessageCircle,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";

const monthlyReport = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map(
  (month) => ({ month, leads: 0, enrollments: 0, revenue: 0 })
);

const lossReasons: Array<{ label: string; value: number; color: string }> = [];

type ReportFilters = {
  period: string;
  seller: string;
  origin: string;
  dateStart: string;
  dateEnd: string;
};

type RealReportData = {
  totalLeads: number;
  enrollments: number;
  revenue: number;
  conversion: number;
  averageTicket: number;
  aiHandled: number;
  responseTime: string;
  origins: Array<{ label: string; value: number; percent: number }>;
  sellers: Array<{ seller: string; closed: number; revenue: string; conversion: number; position: number; progress: number }>;
  funnelData: Array<{ etapa: string; value: number }>;
  aiPerformance: Array<{ metric: string; value: number; detail: string }>;
  monthlyReport: Array<{ month: string; leads: number; enrollments: number; revenue: number }>;
  campaignConversion: Array<{ campaign: string; leads: number; enrollments: number; conversion: number }>;
  lossReasons: Array<{ label: string; value: number; color: string }>;
} | null;

type LoadedReportData = NonNullable<RealReportData>;

function getInitialFilters(): ReportFilters {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    period: "30d",
    seller: "Todos",
    origin: "Todas",
    dateStart: start.toISOString().slice(0, 10),
    dateEnd: end.toISOString().slice(0, 10)
  };
}

const initialFilters: ReportFilters = {
  ...getInitialFilters()
};

export default function RelatoriosPage() {
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(initialFilters);
  const [generatedAt, setGeneratedAt] = useState("gerado agora");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isExpandedSectionOpen, setIsExpandedSectionOpen] = useState(false);
  const [realReportData, setRealReportData] = useState<RealReportData>(null);
  const sellers = useMemo(() => ["Todos", ...(realReportData?.sellers.map((seller) => seller.seller) ?? [])], [realReportData?.sellers]);
  const origins = useMemo(() => ["Todas", ...(realReportData?.origins.map((origin) => origin.label) ?? [])], [realReportData?.origins]);

  const report = useMemo(() => {
    const fallbackReport = {
      totalLeads: 0,
      enrollments: 0,
      revenue: 0,
      conversion: 0,
      averageTicket: 0,
      aiHandled: 0,
      responseTime: "0s"
    };

    return realReportData ? {
      totalLeads: realReportData.totalLeads,
      enrollments: realReportData.enrollments,
      revenue: realReportData.revenue,
      conversion: realReportData.conversion,
      averageTicket: realReportData.averageTicket,
      aiHandled: realReportData.aiHandled,
      responseTime: realReportData.responseTime
    } : fallbackReport;
  }, [appliedFilters, realReportData]);

  const sellerRows = useMemo(() => {
    if (realReportData?.sellers.length) {
      return realReportData.sellers;
    }

    return [];
  }, [realReportData]);

  const filteredOrigins = useMemo(
    () => realReportData?.origins.length
      ? realReportData.origins
      : [],
    [realReportData]
  );
  const displayCampaigns = realReportData?.campaignConversion ?? [];
  const displayFunnelData = realReportData?.funnelData ?? [];
  const displayAiPerformance = realReportData?.aiPerformance ?? [];
  const displayMonthlyReport = realReportData?.monthlyReport ?? monthlyReport;
  const displayLossReasons = realReportData?.lossReasons ?? lossReasons;

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    void generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateReport() {
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: new Date(`${filters.dateStart}T00:00:00`).toISOString(),
          end: new Date(`${filters.dateEnd}T23:59:59`).toISOString(),
          origin: filters.origin,
          seller: filters.seller,
          limit: 500
        })
      });
      if (!response.ok) throw new Error("Falha ao gerar relatorio com dados reais.");

      const data = await response.json() as {
        summary?: {
          totalLeads: number;
          enrollments: number;
          revenue: number;
          conversion: number;
          averageTicket: number;
          aiHandled: number;
          responseTime: string;
        };
        origins?: LoadedReportData["origins"];
        sellers?: LoadedReportData["sellers"];
        funnelData?: LoadedReportData["funnelData"];
        aiPerformance?: LoadedReportData["aiPerformance"];
        monthlyReport?: LoadedReportData["monthlyReport"];
        campaignConversion?: LoadedReportData["campaignConversion"];
        lossReasons?: LoadedReportData["lossReasons"];
      };
      const summary = data.summary ?? {
        totalLeads: 0,
        enrollments: 0,
        revenue: 0,
        conversion: 0,
        averageTicket: 0,
        aiHandled: 0,
        responseTime: "Aguardando dados"
      };

      setRealReportData({
        totalLeads: summary.totalLeads,
        enrollments: summary.enrollments,
        revenue: summary.revenue,
        conversion: summary.conversion,
        averageTicket: summary.averageTicket,
        aiHandled: summary.aiHandled,
        responseTime: summary.responseTime,
        origins: data.origins ?? [],
        sellers: data.sellers ?? [],
        funnelData: data.funnelData ?? [],
        aiPerformance: data.aiPerformance ?? [],
        monthlyReport: data.monthlyReport ?? monthlyReport,
        campaignConversion: data.campaignConversion ?? [],
        lossReasons: data.lossReasons ?? []
      });
    } catch (error) {
      console.warn("[relatorios] falha ao carregar dados reais", error);
      setRealReportData(null);
    }

    setAppliedFilters(filters);
    setGeneratedAt(
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date())
    );
    setIsReportOpen(true);
  }

  async function generatePdf() {
    const permissionResponse = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: new Date(`${appliedFilters.dateStart}T00:00:00`).toISOString(),
        end: new Date(`${appliedFilters.dateEnd}T23:59:59`).toISOString(),
        origin: appliedFilters.origin,
        seller: appliedFilters.seller
      })
    });

    if (!permissionResponse.ok) {
      const permissionPayload = await permissionResponse.json().catch(() => ({})) as { error?: string };
      window.alert(permissionPayload.error || "Seu usuario nao tem permissao para gerar PDF.");
      return;
    }

    const blob = await permissionResponse.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-auto-pro-ia-${appliedFilters.dateStart}-a-${appliedFilters.dateEnd}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar title="Relatorios" subtitle="Performance comercial, IA e matriculas" />
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_26%_0%,rgba(56,189,248,0.10),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_30%),var(--background)] p-4 xl:p-7">
        <section className="mb-6 rounded-[24px] border border-white/[0.08] bg-card/70 p-4 shadow-panel backdrop-blur-xl">
          <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200/80">Central de analise</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-foreground">Relatorios comerciais</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Filtre por periodo, vendedor e origem para acompanhar resultado real de vendas.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <SelectField icon={CalendarDays} value={filters.period} onChange={(value) => updateFilter("period", value)}>
                <option value="7d">Ultimos 7 dias</option>
                <option value="30d">Ultimos 30 dias</option>
                <option value="90d">Ultimos 90 dias</option>
                <option value="year">Ano atual</option>
                <option value="custom">Personalizado</option>
              </SelectField>
              <SelectField icon={Users} value={filters.seller} onChange={(value) => updateFilter("seller", value)}>
                {sellers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField icon={Filter} value={filters.origin} onChange={(value) => updateFilter("origin", value)}>
                {origins.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectField>
              <label className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <input
                  type="date"
                  value={filters.dateStart}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, dateStart: event.target.value, period: "custom" }));
                  }}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-[#111827] pl-9 pr-3 text-xs font-bold text-foreground outline-none transition [color-scheme:dark] hover:border-primary/35 hover:bg-[#162033] focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <label className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <input
                  type="date"
                  value={filters.dateEnd}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, dateEnd: event.target.value, period: "custom" }));
                  }}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-[#111827] pl-9 pr-3 text-xs font-bold text-foreground outline-none transition [color-scheme:dark] hover:border-primary/35 hover:bg-[#162033] focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <button
                type="button"
                onClick={generateReport}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-sky-300/25 bg-sky-300/12 px-4 text-xs font-black text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.10)] transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-sky-300/18"
              >
                <BarChart3 className="size-4" />
                Gerar relatorio
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
              Dados aplicados: {appliedFilters.seller} / {appliedFilters.origin}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
              Periodo: {appliedFilters.dateStart} ate {appliedFilters.dateEnd}
            </span>
            <span className="rounded-full border border-sky-300/15 bg-sky-300/10 px-3 py-1 text-sky-100">
              Relatorio {generatedAt}
            </span>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportKpi icon={Target} label="Matriculas" value={report.enrollments.toString()} detail={`${report.conversion}% de conversao`} tone="sky" />
          <ReportKpi icon={TrendingUp} label="Receita estimada" value={formatCurrency(report.revenue)} detail={`Ticket medio ${formatCurrency(report.averageTicket)}`} tone="emerald" />
          <ReportKpi icon={Bot} label="IA atendendo" value={report.aiHandled.toString()} detail={`Tempo medio ${report.responseTime}`} tone="violet" />
          <ReportKpi icon={MessageCircle} label="Leads captados" value={report.totalLeads.toString()} detail={`${appliedFilters.dateStart} ate ${appliedFilters.dateEnd}`} tone="yellow" />
        </section>

        <section className="mb-6 grid items-stretch gap-6 xl:grid-cols-3">
          <ReportPanel title="Campanhas que convertem" subtitle="Anuncios com melhor retorno" icon={TrendingUp}>
            <div className="grid h-full content-between gap-3">
              {displayCampaigns.length ? displayCampaigns.map((campaign) => (
                <div key={campaign.campaign} className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.022))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-foreground">{campaign.campaign}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.leads} leads - {campaign.enrollments} matriculas
                      </p>
                    </div>
                    <span className="font-mono text-sm font-black text-primary">{campaign.conversion}%</span>
                  </div>
                  <Progress value={campaign.conversion} max={35} className="from-yellow-300 to-sky-300" />
                </div>
              )) : (
                <EmptyReportState label="Aguardando canais reais no periodo." />
              )}
            </div>
          </ReportPanel>

          <ReportPanel title="Funil operacional" subtitle="Avanco entre etapas" icon={Activity}>
            <FunnelReport data={displayFunnelData} />
          </ReportPanel>

          <ReportPanel title="Motivos de perda" subtitle="Onde recuperar matriculas" icon={Target}>
            <LossReport data={displayLossReasons} />
          </ReportPanel>
        </section>

        <section className="relative -mt-2 mb-6">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <button
            type="button"
            onClick={() => setIsExpandedSectionOpen((open) => !open)}
            className="group/expand relative mx-auto grid size-11 place-items-center rounded-full border border-white/10 bg-card/95 text-muted-foreground shadow-panel backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-sky-300/25 hover:text-foreground"
            aria-expanded={isExpandedSectionOpen}
            aria-label={isExpandedSectionOpen ? "Recolher relatorios extras" : "Expandir relatorios extras"}
          >
            <ChevronDown className={cn("size-4 transition duration-300", isExpandedSectionOpen && "rotate-180 text-sky-200")} />
            <span className="pointer-events-none absolute left-1/2 top-12 z-20 w-max -translate-x-1/2 translate-y-1 rounded-xl border border-white/10 bg-[#0b1120]/96 px-3 py-2 text-xs font-black text-foreground opacity-0 shadow-panel backdrop-blur-xl transition-all duration-200 group-hover/expand:translate-y-0 group-hover/expand:opacity-100">
              {isExpandedSectionOpen ? "Recolher relatorios" : "Expandir relatorios"}
            </span>
          </button>
        </section>

        <section
          className={cn(
            "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-500 ease-out",
            isExpandedSectionOpen ? "mt-6 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <ReportPanel title="Leads por origem" subtitle="Onda de volume por canal" icon={BarChart3}>
                <OriginReport data={filteredOrigins} />
              </ReportPanel>

              <ReportPanel title="Desempenho da IA" subtitle="Qualidade do atendimento automatico" icon={Bot}>
                <div className="grid gap-3 md:grid-cols-2">
                  {displayAiPerformance.length ? displayAiPerformance.map((item) => (
                    <div key={item.metric} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{item.metric}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <span className="font-mono text-xl font-black text-sky-200">{item.value}%</span>
                      </div>
                      <Progress value={item.value} className="from-sky-400 to-violet-400" />
                    </div>
                  )) : (
                    <EmptyReportState label="Aguardando metricas reais da IA." />
                  )}
                </div>
              </ReportPanel>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
              <ReportPanel title="Conversao mensal" subtitle="Leads, matriculas e receita por mes" icon={LineChart}>
                <MonthlyReportChart data={displayMonthlyReport} />
              </ReportPanel>

              <ReportPanel title="Relatorio por vendedor" subtitle="Ranking de fechamentos e receita" icon={Trophy}>
                <div className="grid max-h-[390px] gap-3 overflow-y-auto pr-1 [scrollbar-color:rgba(56,189,248,0.35)_transparent] [scrollbar-width:thin]">
                  {sellerRows.map((row) => (
                    <SellerReportRow key={row.seller} row={row} />
                  ))}
                </div>
              </ReportPanel>
            </section>
          </div>
        </section>
      </main>
      {isReportOpen ? (
        <div className="fixed inset-0 z-[120] bg-background/82 p-4 backdrop-blur-xl">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/[0.10] bg-[#07111f] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="no-print flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Relatorio gerado</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Resumo comercial pronto para PDF</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generatePdf}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-300/25 bg-sky-300/12 px-4 text-xs font-black text-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-300/18"
                >
                  <Download className="size-4" />
                  Gerar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportOpen(false)}
                  className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
                  aria-label="Fechar relatorio"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <GeneratedReport
                filters={appliedFilters}
                generatedAt={generatedAt}
                report={report}
                sellerRows={sellerRows}
                origins={filteredOrigins}
                funnelData={displayFunnelData}
                lossReasons={displayLossReasons}
                monthlyReport={displayMonthlyReport}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SelectField({
  icon: Icon,
  value,
  onChange,
  children
}: {
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-[#111827] pl-9 pr-8 text-xs font-bold text-foreground outline-none transition hover:border-primary/35 hover:bg-[#162033] focus:border-primary/55 focus:ring-4 focus:ring-primary/10 [&>option]:bg-[#0B1120] [&>option]:text-slate-100"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
    </label>
  );
}

function ReportKpi({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone: "sky" | "emerald" | "violet" | "yellow";
}) {
  const tones = {
    sky: "from-sky-400/14 border-sky-300/15 text-sky-200",
    emerald: "from-emerald-400/14 border-emerald-300/15 text-emerald-200",
    violet: "from-violet-400/14 border-violet-300/15 text-violet-200",
    yellow: "from-yellow-300/14 border-yellow-300/15 text-yellow-200"
  };

  return (
    <article className={cn("rounded-[22px] border bg-gradient-to-br to-card/80 p-4 shadow-panel transition duration-300 hover:-translate-y-1 hover:scale-[1.01]", tones[tone])}>
      <div className="mb-4 grid size-10 place-items-center rounded-xl border border-current/20 bg-current/10">
        <Icon className="size-5" />
      </div>
      <p className="text-3xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function ReportPanel({
  title,
  subtitle,
  icon: Icon,
  children
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <article className="flex h-full min-h-[420px] flex-col rounded-[24px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(17,24,39,0.86),rgba(8,15,27,0.94))] p-5 shadow-panel transition duration-300 hover:-translate-y-1 hover:border-sky-300/16 hover:shadow-[0_30px_80px_rgba(0,0,0,0.38)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-normal">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-xl border border-sky-300/18 bg-sky-300/10 text-sky-200">
          <Icon className="size-5" />
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

function EmptyReportState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[120px] place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.028] p-4 text-center text-sm font-bold text-muted-foreground">
      {label}
    </div>
  );
}

function GeneratedReport({
  filters,
  generatedAt,
  report,
  sellerRows,
  origins,
  funnelData,
  lossReasons,
  monthlyReport
}: {
  filters: ReportFilters;
  generatedAt: string;
  report: {
    totalLeads: number;
    enrollments: number;
    revenue: number;
    conversion: number;
    averageTicket: number;
    aiHandled: number;
    responseTime: string;
  };
  sellerRows: Array<{ seller: string; closed: number; revenue: string; conversion: number; position: number; progress: number }>;
  origins: Array<{ label: string; value: number; percent: number }>;
  funnelData: Array<{ etapa: string; value: number }>;
  lossReasons: Array<{ label: string; value: number; color: string }>;
  monthlyReport: Array<{ month: string; leads: number; enrollments: number; revenue: number }>;
}) {
  const bestSeller = sellerRows[0];
  const bestOrigin = origins.slice().sort((a, b) => b.value - a.value)[0];

  return (
    <article className="print-report mx-auto max-w-5xl rounded-[24px] border border-slate-200 bg-white p-8 text-slate-950 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
      <header className="mb-8 flex items-start justify-between gap-8 border-b border-slate-200 pb-6">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-sky-700">
            <FileText className="size-3.5" />
            Auto Pro IA 1.1
          </div>
          <h1 className="text-3xl font-black tracking-tight">Relatorio comercial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Analise de performance comercial, origem de leads, ranking de vendedores, conversao mensal e eficiencia da IA.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-right text-xs font-bold text-slate-600">
          <p>Gerado em</p>
          <p className="mt-1 text-lg font-black text-slate-950">{generatedAt}</p>
          <p className="mt-3">Periodo</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {filters.dateStart} ate {filters.dateEnd}
          </p>
        </div>
      </header>

      <section className="mb-8 grid gap-3 md:grid-cols-4">
        <PdfMetric label="Leads captados" value={report.totalLeads.toString()} detail={`${filters.origin}`} />
        <PdfMetric label="Matriculas" value={report.enrollments.toString()} detail={`${report.conversion}% conversao`} />
        <PdfMetric label="Receita estimada" value={formatCurrency(report.revenue)} detail={`Ticket ${formatCurrency(report.averageTicket)}`} />
        <PdfMetric label="IA atendendo" value={report.aiHandled.toString()} detail={`SLA medio ${report.responseTime}`} />
      </section>

      <section className="mb-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <h2 className="text-lg font-black">Resumo executivo</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <p>
              Melhor vendedor: <strong className="text-slate-950">{bestSeller?.seller ?? "Sem dados"}</strong>.
            </p>
            <p>
              Principal canal: <strong className="text-slate-950">{bestOrigin?.label ?? "Sem dados"}</strong>.
            </p>
            <p>
              Filtro aplicado: <strong className="text-slate-950">{filters.seller}</strong> /{" "}
              <strong className="text-slate-950">{filters.origin}</strong>.
            </p>
            <p>
              Comentario IA: priorize leads quentes com origem em canais pagos e cobre follow-up dos contatos sem resposta.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <h2 className="text-lg font-black">Ranking por vendedor</h2>
          <div className="mt-4 grid gap-3">
            {sellerRows.map((row) => (
              <div key={row.seller} className="grid grid-cols-[34px_1fr_auto] items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-sky-50 font-mono text-xs font-black text-sky-700">
                  #{row.position}
                </span>
                <div>
                  <p className="text-sm font-black">{row.seller}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500" style={{ width: `${row.progress}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-black">{row.closed}</p>
                  <p className="text-[10px] font-bold text-slate-500">{row.conversion}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 p-5">
        <h2 className="text-lg font-black">Conversao mensal</h2>
        <div className="mt-5 grid h-56 grid-cols-12 items-end gap-2">
          {monthlyReport.map((month) => {
            const maxLeads = Math.max(1, ...monthlyReport.map((item) => item.leads));
            const height = Math.max(12, (month.leads / maxLeads) * 100);
            return (
              <div key={month.month} className="flex h-full flex-col justify-end gap-2">
                <div className="rounded-t-lg bg-gradient-to-t from-sky-600 to-cyan-300" style={{ height: `${height}%` }} />
                <p className="text-center text-[10px] font-black text-slate-500">{month.month}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <PdfList title="Leads por origem" items={origins.map((item) => `${item.label}: ${item.value} leads (${item.percent}%)`)} />
        <PdfList title="Funil operacional" items={funnelData.map((item) => `${item.etapa}: ${item.value} leads`)} />
        <PdfList title="Motivos de perda" items={lossReasons.map((item) => `${item.label}: ${item.value}%`)} />
      </section>
    </article>
  );
}

function PdfMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  );
}

function PdfList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <h2 className="font-black">{title}</h2>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthlyReportChart({ data }: { data: Array<{ month: string; leads: number; enrollments: number; revenue: number }> }) {
  const maxLeads = Math.max(1, ...data.map((item) => item.leads));
  const maxEnrollments = Math.max(1, ...data.map((item) => item.enrollments));

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-background/35 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-300" /> Leads</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-yellow-300" /> Matriculas</span>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-black text-foreground transition hover:border-sky-300/25 hover:bg-sky-300/10">
          <Download className="size-3.5" />
          Exportar
        </button>
      </div>
      <div className="grid h-72 grid-cols-12 items-end gap-2">
        {data.map((item) => {
          const leadsHeight = Math.max(16, (item.leads / maxLeads) * 100);
          const enrollmentsHeight = Math.max(10, (item.enrollments / maxEnrollments) * 82);
          const conversion = Math.round((item.enrollments / item.leads) * 1000) / 10;

          return (
            <div key={item.month} className="group relative flex h-full flex-col justify-end gap-2">
              <div className="relative flex h-full items-end justify-center gap-1.5 rounded-xl bg-white/[0.025] px-1.5 py-2">
                <div className="w-3 rounded-full bg-gradient-to-t from-sky-500 to-cyan-200 shadow-[0_0_18px_rgba(56,189,248,0.18)] transition group-hover:brightness-125" style={{ height: `${leadsHeight}%` }} />
                <div className="w-3 rounded-full bg-gradient-to-t from-yellow-500 to-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.16)] transition group-hover:brightness-125" style={{ height: `${enrollmentsHeight}%` }} />
              </div>
              <p className="text-center text-xs font-black text-muted-foreground group-hover:text-foreground">{item.month}</p>
              <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 w-44 -translate-x-1/2 translate-y-2 rounded-xl border border-white/10 bg-background/95 p-3 text-xs opacity-0 shadow-panel backdrop-blur-xl transition group-hover:translate-y-0 group-hover:opacity-100">
                <p className="font-black text-foreground">{item.month}</p>
                <p className="mt-1 text-muted-foreground">{item.leads} leads</p>
                <p className="text-muted-foreground">{item.enrollments} matriculas</p>
                <p className="text-sky-200">{conversion}% conversao</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SellerReportRow({
  row
}: {
  row: { seller: string; closed: number; revenue: string; conversion: number; position: number; progress: number };
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 transition hover:-translate-y-0.5 hover:border-sky-300/18 hover:bg-white/[0.055]">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl border border-sky-300/20 bg-sky-300/10 font-mono text-sm font-black text-sky-200">
          #{row.position}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black">{row.seller}</p>
          <p className="text-xs text-muted-foreground">{row.revenue} em vendas</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-black">{row.closed}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">fech.</p>
        </div>
      </div>
      <Progress value={row.progress} className="from-sky-400 to-violet-400" />
      <p className="mt-2 text-xs font-bold text-muted-foreground">{row.conversion}% de conversao</p>
    </div>
  );
}

function OriginReport({ data }: { data: Array<{ label: string; value: number; percent: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const points = data
    .map((item, index) => {
      const x = 8 + (index / Math.max(data.length - 1, 1)) * 84;
      const y = 76 - (item.value / max) * 54;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.13),transparent_45%),rgba(255,255,255,0.025)] p-3">
        <svg viewBox="0 0 100 84" className="h-32 w-full" role="img" aria-label="Onda de leads por origem">
          <defs>
            <linearGradient id="originWave" x1="0" x2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f9fafb" />
            </linearGradient>
            <linearGradient id="originWaveFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={`8,80 ${points} 92,80`} fill="url(#originWaveFill)" stroke="none" />
          <polyline points={points} fill="none" stroke="url(#originWave)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((item, index) => {
            const x = 8 + (index / Math.max(data.length - 1, 1)) * 84;
            const y = 76 - (item.value / max) * 54;
            return <circle key={item.label} cx={x} cy={y} r="2.8" fill="#0B1120" stroke="#facc15" strokeWidth="1.8" />;
          })}
        </svg>
      </div>

      <div className="grid gap-2">
        {data.slice(0, 5).map((item) => (
          <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <span className="truncate text-xs font-black">{item.label}</span>
            <span className="font-mono text-xs font-black text-sky-200">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelReport({ data }: { data: Array<{ etapa: string; value: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const colors = [
    "from-cyan-300 to-sky-500",
    "from-primary to-yellow-500",
    "from-slate-200 to-slate-500",
    "from-[#0B5FA5] to-[#0f4c8a]",
    "from-slate-600 to-slate-800"
  ];

  return (
    <div className="grid h-full content-between gap-3">
      {data.length ? data.map((item, index) => (
        <div key={item.etapa} className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.052),rgba(255,255,255,0.018))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-black">{item.etapa}</span>
            <span className="font-mono text-sm font-black text-foreground">{item.value}</span>
          </div>
          <div className="relative h-9 overflow-hidden rounded-xl bg-[#0b1120]/70 ring-1 ring-white/[0.04]">
            <div
              className={cn("absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-lg bg-gradient-to-r shadow-[0_0_22px_rgba(56,189,248,0.16)]", colors[index % colors.length])}
              style={{
                width: `${Math.max(24, (item.value / max) * 94)}%`,
                clipPath: `polygon(${Math.min(18, index * 4)}% 0, ${100 - Math.min(18, index * 4)}% 0, ${92 - Math.min(18, index * 4)}% 100%, ${8 + Math.min(18, index * 4)}% 100%)`
              }}
            />
            <span className="absolute inset-0 grid place-items-center font-mono text-xs font-black text-[#0B1120]">
              {Math.round((item.value / max) * 100)}%
            </span>
          </div>
        </div>
      )) : (
        <EmptyReportState label="Aguardando dados reais do funil." />
      )}
    </div>
  );
}

function LossReport({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));

  return (
    <div className="grid h-full content-between gap-3">
      {data.length ? data.map((item, index) => (
        <div key={item.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.052),rgba(255,255,255,0.018))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
          <div className="relative grid size-11 place-items-center rounded-2xl border border-white/[0.08] bg-[#0B1120] shadow-[0_0_22px_rgba(11,95,165,0.12)]">
            <svg viewBox="0 0 42 42" className="absolute inset-1">
              <defs>
                <linearGradient id={`lossRing-${index}`} x1="0" x2="1">
                  <stop offset="0%" stopColor="#FACC15" />
                  <stop offset="55%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#F9FAFB" />
                </linearGradient>
              </defs>
              <circle cx="21" cy="21" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                stroke={`url(#lossRing-${index})`}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${(item.value / total) * 100} 100`}
                transform="rotate(-90 21 21)"
              />
            </svg>
            <span className={cn("relative size-2.5 rounded-full", item.color)} />
          </div>
          <div className="min-w-0">
            <span className="flex items-center gap-2 truncate font-black">
              <span className={cn("size-2.5 rounded-full shadow-glow", item.color)} />
              {item.label}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">Impacto no periodo</p>
          </div>
          <span className="font-mono text-sm font-black">{item.value}%</span>
        </div>
      )) : (
        <EmptyReportState label="Aguardando motivos reais de perda." />
      )}
    </div>
  );
}

function Progress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r shadow-[0_0_18px_rgba(56,189,248,0.18)] transition-all duration-500", className)}
        style={{ width: `${Math.min(100, Math.max(4, (value / max) * 100))}%` }}
      />
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}
