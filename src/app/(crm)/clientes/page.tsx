"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, FileText, Link2, Loader2, RefreshCw } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";

type OnboardingStatus = "not_sent" | "waiting" | "in_progress" | "completed";

type ClientRecord = {
  id: string;
  name: string;
  onboarding_status: OnboardingStatus;
  onboarding_completed_at?: string | null;
  onboarding?: {
    id: string;
    status: OnboardingStatus;
    public_url?: string | null;
    last_saved_at?: string | null;
    completed_at?: string | null;
    pdf_generated_at?: string | null;
  } | null;
};

const statusConfig: Record<OnboardingStatus, { label: string; className: string }> = {
  not_sent: { label: "Aguardando preenchimento", className: "border-amber-300/25 bg-amber-300/10 text-amber-100" },
  waiting: { label: "Aguardando preenchimento", className: "border-amber-300/25 bg-amber-300/10 text-amber-100" },
  in_progress: { label: "Aguardando preenchimento", className: "border-sky-300/25 bg-sky-300/10 text-sky-100" },
  completed: { label: "Concluído", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" }
};

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/clients", { cache: "no-store" });
      const data = await response.json() as { clients?: ClientRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Nao foi possivel carregar onboardings.");
      setClients(data.clients ?? []);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar onboardings.");
    } finally {
      setLoading(false);
    }
  }

  async function generateOnboarding() {
    const name = schoolName.trim();
    if (!name) {
      setFeedback("Informe o nome da autoescola.");
      return;
    }

    setGenerating(true);
    setFeedback("");

    try {
      const createResponse = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const createData = await createResponse.json() as { client?: ClientRecord; error?: string };
      if (!createResponse.ok || !createData.client) throw new Error(createData.error || "Nao foi possivel criar onboarding.");

      const linkResponse = await fetch(`/api/clients/${createData.client.id}/onboarding-link`, { method: "POST" });
      const linkData = await linkResponse.json() as { url?: string; onboarding?: ClientRecord["onboarding"]; error?: string };
      if (!linkResponse.ok || !linkData.url) throw new Error(linkData.error || "Nao foi possivel gerar link.");

      await navigator.clipboard?.writeText(linkData.url);
      setSchoolName("");
      setClients((items) => [
        {
          ...createData.client!,
          onboarding_status: "waiting",
          onboarding: {
            ...(linkData.onboarding ?? null),
            public_url: linkData.url
          } as ClientRecord["onboarding"]
        },
        ...items
      ]);
      setFeedback(`Link gerado e copiado para ${name}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel gerar onboarding.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink(link?: string | null) {
    if (!link) {
      setFeedback("Este onboarding ainda nao possui link salvo. Gere um novo link.");
      return;
    }
    await navigator.clipboard?.writeText(link);
    setFeedback("Link copiado.");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Topbar title="Onboard Cliente" subtitle="Gere links de onboarding e receba PDFs para base de conhecimento." />

      <div className="mx-auto w-full max-w-[1380px] px-4 pb-8">
        <section className="rounded-2xl border border-white/[0.08] bg-[#0B1120]/86 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Nome da Autoescola</span>
              <input
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="Ex.: Auto Escola Renacer"
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-bold outline-none transition placeholder:text-slate-500 focus:border-primary/40"
              />
            </label>
            <button
              type="button"
              onClick={() => void generateOnboarding()}
              disabled={generating}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Gerar Link de Onboarding
            </button>
            <button
              type="button"
              onClick={() => void loadClients()}
              className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:border-primary/30 hover:text-primary"
              aria-label="Atualizar"
              title="Atualizar"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>

          {feedback ? (
            <p className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{feedback}</p>
          ) : null}
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070c14]/90">
          <div className="grid min-w-[980px] grid-cols-[1.2fr_180px_1.5fr_180px_120px_120px] gap-3 border-b border-white/[0.08] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            <span>Nome da Autoescola</span>
            <span>Status</span>
            <span>Link do formulário</span>
            <span>Data de envio</span>
            <span>Visualizar PDF</span>
            <span>Baixar PDF</span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-5 text-sm text-muted-foreground">Carregando onboardings...</div>
            ) : clients.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">Nenhum link de onboarding gerado ainda.</div>
            ) : (
              <div className="min-w-[980px] divide-y divide-white/[0.06]">
                {clients.map((client) => {
                  const status = client.onboarding?.status ?? client.onboarding_status;
                  const link = client.onboarding?.public_url;
                  const completed = status === "completed";
                  return (
                    <div key={client.id} className="grid grid-cols-[1.2fr_180px_1.5fr_180px_120px_120px] items-center gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{client.name}</p>
                      </div>
                      <StatusBadge status={status} />
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-xs font-semibold text-slate-300">{link || "Link não gerado"}</span>
                        <button
                          type="button"
                          onClick={() => void copyLink(link)}
                          className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:border-primary/30 hover:text-primary"
                          aria-label="Copiar link"
                          title="Copiar link"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:border-primary/30 hover:text-primary"
                            aria-label="Abrir formulário"
                            title="Abrir formulário"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{formatDate(client.onboarding?.completed_at || client.onboarding_completed_at)}</span>
                      {completed ? (
                        <a
                          href={`/api/clients/${client.id}/onboarding-pdf`}
                          target="_blank"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-black text-slate-200 transition hover:border-primary/30 hover:text-primary"
                        >
                          <FileText className="size-3.5" />
                          Ver
                        </a>
                      ) : (
                        <DisabledPdfButton label="Ver" />
                      )}
                      {completed ? (
                        <a
                          href={`/api/clients/${client.id}/onboarding-pdf?download=1`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground transition hover:brightness-105"
                        >
                          <Download className="size-3.5" />
                          Baixar
                        </a>
                      ) : (
                        <DisabledPdfButton label="Baixar" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: OnboardingStatus }) {
  return (
    <span className={cn("inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border px-2 text-[10px] font-black", statusConfig[status].className)}>
      {status === "completed" ? <CheckCircle2 className="size-3.5" /> : null}
      {statusConfig[status].label}
    </span>
  );
}

function DisabledPdfButton({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs font-black text-slate-600">
      {label}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Ainda não enviado";
  return new Date(value).toLocaleString("pt-BR");
}
