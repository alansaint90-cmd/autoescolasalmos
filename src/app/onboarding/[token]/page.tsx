"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileUp, Loader2, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type OnboardingFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  uploadedAt: string;
};

type StepField = {
  key: string;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
};

type StepConfig = {
  id: string;
  title: string;
  description: string;
  fields: StepField[];
};

const steps: StepConfig[] = [
  {
    id: "school",
    title: "Dados da autoescola",
    description: "Identificação principal para personalizar o agente.",
    fields: [
      { key: "schoolName", label: "Nome da autoescola" },
      { key: "legalName", label: "Razão social" },
      { key: "cnpj", label: "CNPJ" },
      { key: "responsibleName", label: "Responsável pelo projeto" },
      { key: "responsibleRole", label: "Cargo do responsável" }
    ]
  },
  {
    id: "channels",
    title: "Canais e presença digital",
    description: "Links e contatos que a IA poderá consultar ou informar.",
    fields: [
      { key: "address", label: "Endereço completo", type: "textarea" },
      { key: "whatsapp", label: "WhatsApp principal" },
      { key: "instagram", label: "Instagram" },
      { key: "googleProfile", label: "Google/Maps" },
      { key: "site", label: "Site" }
    ]
  },
  {
    id: "hours",
    title: "Horários de atendimento",
    description: "Informe horários presenciais, WhatsApp e exceções.",
    fields: [
      { key: "businessHours", label: "Horário comercial", type: "textarea" },
      { key: "whatsappHours", label: "Horário de atendimento pelo WhatsApp", type: "textarea" },
      { key: "afterHoursRule", label: "Como responder fora do horário?", type: "textarea" }
    ]
  },
  {
    id: "services",
    title: "Serviços, categorias e preços",
    description: "Detalhe categorias A, B, AB, adição, mudança e planos.",
    fields: [
      { key: "servicesOffered", label: "Serviços oferecidos", type: "textarea" },
      { key: "categories", label: "Categorias A, B, AB, adição e mudança", type: "textarea" },
      { key: "prices", label: "Preços e pacotes", type: "textarea" },
      { key: "includedItems", label: "O que está incluso nos pacotes?", type: "textarea" }
    ]
  },
  {
    id: "payments",
    title: "Pagamentos e taxas",
    description: "Formas de pagamento, parcelamento e custos externos.",
    fields: [
      { key: "paymentMethods", label: "Formas de pagamento", type: "textarea" },
      { key: "installments", label: "Parcelamento e condições", type: "textarea" },
      { key: "additionalFees", label: "Taxas adicionais", type: "textarea" },
      { key: "promotions", label: "Promoções vigentes", type: "textarea" }
    ]
  },
  {
    id: "process",
    title: "Processo da habilitação",
    description: "Etapas, documentos, aulas, veículos e diferenciais.",
    fields: [
      { key: "requiredDocuments", label: "Documentos necessários", type: "textarea" },
      { key: "licenseProcess", label: "Processo da habilitação", type: "textarea" },
      { key: "theoryClasses", label: "Aulas teóricas", type: "textarea" },
      { key: "practicalClasses", label: "Aulas práticas", type: "textarea" },
      { key: "vehiclesAndDifferentials", label: "Veículos e diferenciais", type: "textarea" }
    ]
  },
  {
    id: "sales",
    title: "Comercial e prova social",
    description: "Diferenciais, objeções, avaliações e respostas estratégicas.",
    fields: [
      { key: "commercialDifferentials", label: "Diferenciais comerciais", type: "textarea" },
      { key: "frequentQuestions", label: "Perguntas frequentes", type: "textarea" },
      { key: "mainObjections", label: "Principais objeções", type: "textarea" },
      { key: "socialProof", label: "Avaliações e provas sociais", type: "textarea" }
    ]
  },
  {
    id: "ai",
    title: "Agente de IA",
    description: "Como o agente deve falar, qualificar e conduzir o atendimento.",
    fields: [
      { key: "toneOfVoice", label: "Tom de voz desejado", type: "textarea" },
      { key: "qualificationQuestions", label: "Perguntas para qualificar o lead", type: "textarea" },
      { key: "finalGoal", label: "Objetivo final do atendimento", type: "textarea" },
      { key: "humanTransferRules", label: "Quando transferir para humano?", type: "textarea" },
      { key: "forbiddenInfo", label: "Informações que a IA não pode fornecer", type: "textarea" },
      { key: "followUpRules", label: "Regras de follow-up", type: "textarea" }
    ]
  },
  {
    id: "materials",
    title: "Materiais comerciais",
    description: "Envie logo, tabela de preços, PDFs, fotos e materiais de apoio.",
    fields: [
      { key: "materialsNotes", label: "Observações sobre os materiais", type: "textarea" }
    ]
  }
];

export default function PublicOnboardingPage({ params }: { params: { token: string } }) {
  const [clientName, setClientName] = useState("Autoescola");
  const [responses, setResponses] = useState<Record<string, Record<string, string>>>({});
  const [files, setFiles] = useState<OnboardingFile[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const step = steps[activeStep];

  const progress = useMemo(() => Math.round(((activeStep + 1) / steps.length) * 100), [activeStep]);

  useEffect(() => {
    void loadOnboarding();
  }, []);

  async function loadOnboarding() {
    setLoading(true);
    try {
      const response = await fetch(`/api/onboarding/${params.token}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Link inválido.");
      setClientName(data.client?.name ?? "Autoescola");
      setResponses(data.onboarding?.responses ?? {});
      setFiles(data.onboarding?.files ?? []);
      setCompleted(data.onboarding?.status === "completed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível abrir o onboarding.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(stepId: string, key: string, value: string) {
    setResponses((current) => ({
      ...current,
      [stepId]: {
        ...(current[stepId] ?? {}),
        [key]: value
      }
    }));
  }

  async function save(complete = false) {
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch(`/api/onboarding/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, files, complete })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      setCompleted(Boolean(complete));
      setStatus(complete ? "Onboarding concluído. Obrigado!" : "Progresso salvo.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;

    const selected = Array.from(fileList).slice(0, 8);
    const parsed = await Promise.all(selected.map(readFileAsDataUrl));
    setFiles((current) => [...current, ...parsed]);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#070c14] text-white">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
          <Loader2 className="size-5 animate-spin text-primary" />
          Carregando onboarding...
        </div>
      </main>
    );
  }

  if (status && !step) {
    return <ErrorState message={status} />;
  }

  return (
    <main className="min-h-screen bg-[#070c14] text-slate-100">
      <header className="border-b border-white/[0.08] bg-[#0B1120]/92">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[16px] font-black uppercase leading-none tracking-[0.12em]">
              Auto <span className="text-primary">Pro</span> IA
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-slate-400">{clientName}</p>
          </div>
          <div className="hidden items-center gap-2 text-xs font-bold text-slate-400 sm:flex">
            <Sparkles className="size-4 text-primary" />
            Onboarding do agente de IA
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Progresso</p>
            <div className="mt-2 h-2 rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-bold text-slate-400">{progress}% preenchido</p>
          </div>

          <div className="grid gap-1">
            {steps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveStep(index)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition",
                  index === activeStep ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-white/[0.06]"
                )}
              >
                {index < activeStep || completed ? <CheckCircle2 className="size-4" /> : <span className="grid size-4 place-items-center rounded-full border border-current text-[9px]">{index + 1}</span>}
                <span className="min-w-0 truncate">{item.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B1120]/80 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
          {completed ? (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">
              Onboarding concluído. Você ainda pode revisar e salvar ajustes se necessário.
            </div>
          ) : null}

          <div className="mt-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Etapa {activeStep + 1} de {steps.length}</p>
            <h1 className="mt-2 text-2xl font-black tracking-normal">{step.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{step.description}</p>
          </div>

          <div className="mt-5 grid gap-4">
            {step.fields.map((field) => (
              <label key={field.key} className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    value={responses[step.id]?.[field.key] ?? ""}
                    onChange={(event) => updateField(step.id, field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="min-h-28 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-slate-600 focus:border-primary/45"
                  />
                ) : (
                  <input
                    value={responses[step.id]?.[field.key] ?? ""}
                    onChange={(event) => updateField(step.id, field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="h-12 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold outline-none transition placeholder:text-slate-600 focus:border-primary/45"
                  />
                )}
              </label>
            ))}

            {step.id === "materials" ? (
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-white/[0.03] p-6 text-center transition hover:bg-white/[0.06]">
                  <FileUp className="size-8 text-primary" />
                  <span className="text-sm font-black">Enviar logo, tabela, PDFs, fotos e materiais</span>
                  <span className="text-xs text-slate-400">Os arquivos ficam salvos junto às respostas do onboarding.</span>
                  <input type="file" multiple className="hidden" onChange={(event) => void onFilesSelected(event.target.files)} />
                </label>
                {files.length > 0 ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {files.map((file) => (
                      <div key={file.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                        <p className="truncate text-sm font-bold">{file.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatBytes(file.size)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {status ? (
            <p className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">{status}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
              disabled={activeStep === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-black text-slate-200 transition hover:border-white/20 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Voltar
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save(false)}
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/15 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar e continuar depois
              </button>
              {activeStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((current) => Math.min(steps.length - 1, current + 1))}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-105"
                >
                  Próxima etapa
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void save(true)}
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
                >
                  <CheckCircle2 className="size-4" />
                  Concluir onboarding
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070c14] p-5 text-white">
      <div className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0B1120] p-6 text-center">
        <h1 className="text-xl font-black">Não foi possível abrir o onboarding</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </main>
  );
}

function readFileAsDataUrl(file: File): Promise<OnboardingFile> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: typeof reader.result === "string" ? reader.result : undefined,
        uploadedAt: new Date().toISOString()
      });
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Tamanho não informado";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
