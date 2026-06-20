"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  FileWarning,
  Search,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";

const categoryFilters = [
  { label: "Todos", value: "all" },
  { label: "Decisoes da IA", value: "decision" },
  { label: "Erros e sistema", value: "event" },
  { label: "Alertas CRM", value: "notification" }
];

const severityFilters = [
  { label: "Tudo", value: "all" },
  { label: "Erros", value: "error" },
  { label: "Alertas", value: "warning" },
  { label: "Sucesso", value: "success" },
  { label: "Info", value: "info" }
];

const statusStyle: Record<string, { icon: ElementType; className: string }> = {
  captured: { icon: Database, className: "border-sky-300/20 bg-sky-300/10 text-sky-100" },
  config: { icon: AlertTriangle, className: "border-primary/25 bg-primary/10 text-primary" },
  approved: { icon: CheckCircle2, className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" },
  rejected: { icon: FileWarning, className: "border-red-400/20 bg-red-400/10 text-red-200" },
  published: { icon: Bot, className: "border-[#0B5FA5]/30 bg-[#0B5FA5]/15 text-sky-100" }
};

type AuditRow = {
  id: string;
  type: "decision" | "event" | "notification";
  action: string;
  user: string;
  entity: string;
  date: string;
  status: string;
  rawAction: string;
  reason: string;
  mode: string | null;
  safetyStatus: string;
  severity: string;
  metadata: Record<string, unknown>;
};

type AuditSummary = {
  total: number;
  decisions: number;
  errors: number;
  warnings: number;
  aiReplies: number;
  handoffs: number;
  unreadNotifications: number;
};

const emptySummary: AuditSummary = {
  total: 0,
  decisions: 0,
  errors: 0,
  warnings: 0,
  aiReplies: 0,
  handoffs: 0,
  unreadNotifications: 0
};

export default function AnalisePage() {
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [summary, setSummary] = useState<AuditSummary>(emptySummary);
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null);
  const [apiStatus, setApiStatus] = useState<"loading" | "live" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAudit() {
      try {
        const response = await fetch("/api/audit?limit=400", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          rows?: AuditRow[];
          summary?: AuditSummary;
          error?: string;
        };

        if (!response.ok || !payload.rows) throw new Error(payload.error || "Falha ao carregar auditoria.");
        if (!cancelled) {
          setRows(payload.rows);
          setSummary(payload.summary ?? emptySummary);
          setErrorMessage("");
          setApiStatus("live");
        }
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setSummary(emptySummary);
          setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar auditoria.");
          setApiStatus("error");
        }
      }
    }

    void loadAudit();
    const interval = window.setInterval(loadAudit, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesCategory = category === "all" || row.type === category;
      const matchesSeverity = severity === "all" || row.severity === severity;
      const matchesQuery =
        !term ||
        row.action.toLowerCase().includes(term) ||
        row.user.toLowerCase().includes(term) ||
        row.entity.toLowerCase().includes(term) ||
        row.reason.toLowerCase().includes(term) ||
        row.rawAction.toLowerCase().includes(term);

      return matchesCategory && matchesSeverity && matchesQuery;
    });
  }, [category, query, rows, severity]);

  return (
    <>
      <Topbar title="Analise" subtitle="Logs administrativos, erros e decisoes da IA" />

      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_72%_0%,rgba(250,204,21,0.055),transparent_30%),linear-gradient(180deg,#080d16,#0b1120)] p-6 text-foreground">
        <section className="rounded-[28px] border border-white/[0.08] bg-card/70 p-5 shadow-panel backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black",
                apiStatus === "live"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : apiStatus === "loading"
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-red-400/20 bg-red-400/10 text-red-200"
              )}>
                <span className={cn(
                  "size-1.5 rounded-full",
                  apiStatus === "live" ? "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-primary"
                )} />
                {apiStatus === "live" ? "Painel ao vivo" : apiStatus === "loading" ? "Carregando" : "Atenção"}
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-normal">Painel de logs e decisões</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Acompanhe erros operacionais, eventos da Evolution, decisões da IA, handoffs e alertas comerciais sem depender do terminal.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar acao, lead, erro ou motivo..."
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.045] pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10 sm:w-[360px]"
                />
              </div>
              <span className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#0B5FA5]/30 bg-[#0B5FA5]/12 px-4 text-sm font-black text-sky-100">
                <ShieldCheck size={16} />
                Admin
              </span>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard icon={Activity} label="Eventos" value={summary.total} tone="blue" />
            <SummaryCard icon={Bot} label="Decisoes IA" value={summary.decisions} tone="yellow" />
            <SummaryCard icon={FileWarning} label="Erros" value={summary.errors} tone="red" />
            <SummaryCard icon={AlertTriangle} label="Alertas" value={summary.warnings} tone="yellow" />
            <SummaryCard icon={Sparkles} label="Respostas IA" value={summary.aiReplies} tone="blue" />
            <SummaryCard icon={CircleDot} label="Handoffs" value={summary.handoffs} tone="slate" />
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {categoryFilters.map((filter) => (
                <FilterButton
                  key={filter.value}
                  active={category === filter.value}
                  onClick={() => setCategory(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {severityFilters.map((filter) => (
                <FilterButton
                  key={filter.value}
                  active={severity === filter.value}
                  onClick={() => setSeverity(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <p className="font-mono text-muted-foreground">{filteredRows.length} registro(s)</p>
            <p className="text-xs font-bold text-muted-foreground">{apiStatus === "live" ? "Atualiza a cada 10s" : "Sem dados carregados"}</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#080d16]/72">
            <div className="grid grid-cols-[150px_140px_130px_1fr_150px_42px] border-b border-white/[0.07] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <span>Tipo</span>
              <span>Origem</span>
              <span>Severidade</span>
              <span>Detalhe</span>
              <span>Data</span>
              <span />
            </div>
            <div className="max-h-[620px] overflow-y-auto [scrollbar-color:rgba(250,204,21,0.35)_transparent] [scrollbar-width:thin]">
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const StatusIcon = (statusStyle[row.status] ?? statusStyle.captured).icon;

                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      className="group grid w-full grid-cols-[150px_140px_130px_1fr_150px_42px] items-center border-b border-white/[0.05] px-4 py-4 text-left transition last:border-b-0 hover:bg-white/[0.035]"
                    >
                      <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black", (statusStyle[row.status] ?? statusStyle.captured).className)}>
                        <StatusIcon size={13} />
                        {row.action}
                      </span>
                      <span className="truncate text-sm font-semibold text-muted-foreground">{row.user}</span>
                      <SeverityBadge severity={row.severity} />
                      <span className="truncate text-sm font-black text-foreground">{row.entity}</span>
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{row.date}</span>
                      <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  );
                })
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
                  <Database className="size-10 text-primary" />
                  <p className="mt-4 text-lg font-black">Nenhum registro encontrado</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Assim que a Evolution, IA, follow-up ou CRM registrarem eventos, eles aparecem aqui.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {selectedRow ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/55 p-4 backdrop-blur-sm" onClick={() => setSelectedRow(null)}>
            <aside
              className="h-full w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/[0.10] bg-[#0b1120] p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SeverityBadge severity={selectedRow.severity} />
                  <h2 className="mt-3 text-2xl font-black">{selectedRow.action}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedRow.date}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="grid size-10 place-items-center rounded-2xl border border-white/[0.10] bg-white/[0.04] text-muted-foreground transition hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailBox label="Origem" value={selectedRow.user} />
                <DetailBox label="Evento tecnico" value={selectedRow.rawAction} />
                <DetailBox label="Modo" value={selectedRow.mode ?? "Nao informado"} />
                <DetailBox label="Status" value={selectedRow.safetyStatus} />
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Motivo / mensagem</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{selectedRow.reason}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070b13] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Metadata</p>
                <pre className="mt-3 max-h-[380px] overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-4 text-xs leading-5 text-slate-200">
                  {JSON.stringify(selectedRow.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: number; tone: "blue" | "yellow" | "red" | "slate" }) {
  const tones = {
    blue: "border-[#0B5FA5]/30 bg-[#0B5FA5]/10 text-sky-100",
    yellow: "border-primary/25 bg-primary/10 text-primary",
    red: "border-red-400/25 bg-red-400/10 text-red-100",
    slate: "border-white/[0.10] bg-white/[0.04] text-slate-100"
  };

  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <Icon className="size-5" />
      <p className="mt-4 text-2xl font-black">{value}</p>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-4 text-xs font-black transition",
        active
          ? "border-primary/60 bg-primary text-primary-foreground shadow-glow"
          : "border-white/[0.10] bg-white/[0.035] text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    error: "border-red-400/25 bg-red-400/10 text-red-100",
    warning: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    info: "border-sky-300/20 bg-sky-300/10 text-sky-100"
  };

  return (
    <span className={cn("inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black", styles[severity] ?? styles.info)}>
      {severityLabel(severity)}
    </span>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    error: "Erro",
    warning: "Alerta",
    success: "Sucesso",
    info: "Info"
  };
  return labels[severity] ?? "Info";
}
