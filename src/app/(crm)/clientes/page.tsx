"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Copy, ExternalLink, FileText, Loader2, Plus, RefreshCw, Send, Sparkles } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";

type OnboardingStatus = "not_sent" | "waiting" | "in_progress" | "completed";

type ClientRecord = {
  id: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_completed_at?: string | null;
  onboarding?: {
    id: string;
    status: OnboardingStatus;
    responses: Record<string, unknown>;
    files: Array<Record<string, unknown>>;
    last_saved_at?: string | null;
    completed_at?: string | null;
  } | null;
};

const statusConfig: Record<OnboardingStatus, { label: string; className: string }> = {
  not_sent: { label: "Não enviado", className: "border-slate-500/25 bg-slate-500/10 text-slate-300" },
  waiting: { label: "Aguardando preenchimento", className: "border-amber-300/25 bg-amber-300/10 text-amber-100" },
  in_progress: { label: "Em preenchimento", className: "border-sky-300/25 bg-sky-300/10 text-sky-100" },
  completed: { label: "Concluído", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" }
};

const responseSections = [
  { key: "school", title: "Dados da autoescola" },
  { key: "channels", title: "Canais e presença digital" },
  { key: "hours", title: "Horários de atendimento" },
  { key: "services", title: "Serviços, categorias e preços" },
  { key: "payments", title: "Pagamento, pacotes e taxas" },
  { key: "process", title: "Processo da habilitação" },
  { key: "sales", title: "Comercial, objeções e provas sociais" },
  { key: "ai", title: "Configuração do agente de IA" },
  { key: "followup", title: "Follow-up e transferência humana" },
  { key: "restrictions", title: "Limites e informações proibidas" }
];

const emptyDraft = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: ""
};

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState("");
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");

  const selected = useMemo(
    () => clients.find((client) => client.id === selectedId) ?? clients[0],
    [clients, selectedId]
  );

  useEffect(() => {
    void loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/clients", { cache: "no-store" });
      const data = await response.json() as { clients?: ClientRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Nao foi possivel carregar clientes.");
      const list = data.clients ?? [];
      setClients(list);
      setSelectedId((current) => current || list[0]?.id || "");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  async function createClient() {
    if (!draft.name.trim()) {
      setFeedback("Informe o nome da autoescola.");
      return;
    }

    setSaving(true);
    setFeedback("");

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json() as { client?: ClientRecord; error?: string };
      if (!response.ok || !data.client) throw new Error(data.error || "Nao foi possivel criar cliente.");
      setDraft(emptyDraft);
      setClients((items) => [data.client!, ...items]);
      setSelectedId(data.client.id);
      setFeedback("Cliente criado. Agora gere o link de onboarding.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel criar cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function generateLink(clientId: string) {
    setGeneratingId(clientId);
    setFeedback("");

    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding-link`, { method: "POST" });
      const data = await response.json() as { url?: string; onboarding?: ClientRecord["onboarding"]; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Nao foi possivel gerar link.");
      setGeneratedLinks((links) => ({ ...links, [clientId]: data.url! }));
      setClients((items) => items.map((client) =>
        client.id === clientId
          ? { ...client, onboarding_status: "waiting", onboarding: data.onboarding ?? client.onboarding }
          : client
      ));
      await navigator.clipboard?.writeText(data.url);
      setFeedback("Link gerado e copiado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel gerar link.");
    } finally {
      setGeneratingId("");
    }
  }

  async function copyLink(clientId: string) {
    const link = generatedLinks[clientId];
    if (!link) {
      setFeedback("Gere um novo link para copiar. Por segurança, links antigos não são exibidos novamente.");
      return;
    }
    await navigator.clipboard?.writeText(link);
    setFeedback("Link copiado.");
  }

  const responses = selected?.onboarding?.responses ?? {};
  const files = selected?.onboarding?.files ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Topbar title="Clientes" subtitle="Onboarding público para alimentar a IA de cada autoescola." />

      <div className="mx-auto grid w-full max-w-[1480px] gap-4 px-4 pb-8 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B1120]/82 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Novo cliente</p>
              <h2 className="mt-1 text-lg font-black">Cadastro da autoescola</h2>
            </div>
            <button
              type="button"
              onClick={() => void loadClients()}
              className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:border-primary/30 hover:text-primary"
              aria-label="Atualizar clientes"
              title="Atualizar"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <ClientInput label="Autoescola" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
            <ClientInput label="Responsável" value={draft.contactName} onChange={(value) => setDraft((current) => ({ ...current, contactName: value }))} />
            <ClientInput label="Email" value={draft.contactEmail} onChange={(value) => setDraft((current) => ({ ...current, contactEmail: value }))} />
            <ClientInput label="WhatsApp" value={draft.contactPhone} onChange={(value) => setDraft((current) => ({ ...current, contactPhone: value }))} />
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Observações internas"
              className="min-h-20 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-semibold outline-none transition placeholder:text-slate-500 focus:border-primary/40"
            />
            <button
              type="button"
              onClick={() => void createClient()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Criar cliente
            </button>
          </div>

          {feedback ? (
            <p className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{feedback}</p>
          ) : null}

          <div className="mt-5 grid gap-2">
            {loading ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-muted-foreground">Carregando clientes...</div>
            ) : clients.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</div>
            ) : clients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedId(client.id)}
                className={cn(
                  "min-w-0 rounded-xl border p-3 text-left transition",
                  selected?.id === client.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-black">{client.name}</span>
                  <StatusBadge status={client.onboarding_status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{client.contact_name || client.contact_phone || "Sem contato informado"}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#070c14]/88 p-4">
          {!selected ? (
            <div className="grid min-h-[420px] place-items-center text-center text-muted-foreground">
              <div>
                <Sparkles className="mx-auto size-9 text-primary" />
                <p className="mt-3 text-sm font-bold">Cadastre uma autoescola para gerar o onboarding.</p>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Cadastro do cliente</p>
                  <h2 className="mt-1 truncate text-2xl font-black">{selected.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.contact_name || "Responsável não informado"} · {selected.contact_phone || "WhatsApp não informado"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generateLink(selected.id)}
                    disabled={generatingId === selected.id}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
                  >
                    {generatingId === selected.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Gerar link de onboarding
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyLink(selected.id)}
                    className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:border-primary/30 hover:text-primary"
                    aria-label="Copiar link"
                    title="Copiar link"
                  >
                    <Copy className="size-4" />
                  </button>
                  {generatedLinks[selected.id] ? (
                    <a
                      href={generatedLinks[selected.id]}
                      target="_blank"
                      className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:border-primary/30 hover:text-primary"
                      aria-label="Abrir onboarding"
                      title="Abrir onboarding"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                </div>
              </div>

              {generatedLinks[selected.id] ? (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">Link exclusivo</p>
                  <p className="mt-1 break-all text-sm font-bold text-primary">{generatedLinks[selected.id]}</p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="Status" value={statusConfig[selected.onboarding_status].label} />
                <Metric label="Último salvamento" value={formatDate(selected.onboarding?.last_saved_at)} />
                <Metric label="Concluído em" value={formatDate(selected.onboarding?.completed_at || selected.onboarding_completed_at)} />
              </div>

              <div className="mt-5 grid gap-3">
                <div className="flex items-center gap-2">
                  <Clipboard className="size-4 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-300">Respostas do onboarding</h3>
                </div>
                {Object.keys(responses).length === 0 ? (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm text-muted-foreground">
                    As respostas aparecerão aqui quando o cliente salvar o onboarding.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {responseSections.map((section) => (
                      <ResponseSection key={section.key} title={section.title} value={responses[section.key]} />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-300">Materiais enviados</h3>
                </div>
                {files.length === 0 ? (
                  <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-muted-foreground">Nenhum arquivo enviado ainda.</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {files.map((file, index) => (
                      <div key={String(file.id ?? index)} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                        <p className="truncate text-sm font-bold">{String(file.name ?? "Arquivo")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatBytes(Number(file.size ?? 0))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ClientInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold outline-none transition placeholder:text-slate-500 focus:border-primary/40"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: OnboardingStatus }) {
  return (
    <span className={cn("shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black", statusConfig[status].className)}>
      {statusConfig[status].label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function ResponseSection({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3" open>
      <summary className="cursor-pointer text-sm font-black">{title}</summary>
      <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-5 text-slate-300">
        {formatResponse(value)}
      </pre>
    </details>
  );
}

function formatResponse(value: unknown) {
  if (!value) return "Sem resposta.";
  if (typeof value === "string") return value || "Sem resposta.";
  return JSON.stringify(value, null, 2);
}

function formatDate(value?: string | null) {
  if (!value) return "Ainda não";
  return new Date(value).toLocaleString("pt-BR");
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Tamanho não informado";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
