"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Bot, LogOut, Search, UserRound, X } from "lucide-react";

const COMPANY_PROFILE_STORAGE_KEY = "auto-pro-ia:company-profile";

type TopbarNotification = {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: typeof Bot;
  tone: string;
};

const fallbackNotifications: TopbarNotification[] = [];

const emptyLead = {
  name: "",
  phone: "",
  origin: "WhatsApp",
  status: "novo",
  temperature: "quente",
  sentiment: "positivo",
  lastMessage: "",
  responsible: "Equipe comercial",
  notes: ""
};

type CompanyProfile = {
  name: string;
  logo?: string;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const defaultCompanyProfile: CompanyProfile = {
  name: "AutoEscola Pro"
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

function formatNotificationTime(value?: string) {
  if (!value) return "agora";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 6_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

type TopbarProps = {
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onNewLead?: () => void;
  extraControls?: ReactNode;
};

export function Topbar({ title, subtitle, searchValue, onSearchChange, onNewLead, extraControls }: TopbarProps) {
  const hasInteractiveSearch = typeof onSearchChange === "function";
  const [globalSearch, setGlobalSearch] = useState("");
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [leadDraft, setLeadDraft] = useState(emptyLead);
  const [notifications, setNotifications] = useState<TopbarNotification[]>(fallbackNotifications);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const response = await fetchWithTimeout("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as {
          notifications?: Array<{ id: string; title: string; description: string; createdAt?: string }>;
        };
        if (cancelled) return;
        setNotifications((payload.notifications ?? []).map((notification) => ({
          id: notification.id,
          title: notification.title,
          description: notification.description,
          time: formatNotificationTime(notification.createdAt),
          icon: Bot,
          tone: "text-primary"
        })));
      } catch {
        if (!cancelled) setNotifications(fallbackNotifications);
      }
    }

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function loadCompanyProfile() {
      try {
        const stored = window.localStorage.getItem(COMPANY_PROFILE_STORAGE_KEY);
        if (stored) {
          setCompanyProfile({ ...defaultCompanyProfile, ...(JSON.parse(stored) as CompanyProfile) });
        }
      } catch {
        setCompanyProfile(defaultCompanyProfile);
      }
    }

    loadCompanyProfile();
    window.addEventListener("auto-pro-ia:company-profile-updated", loadCompanyProfile);
    window.addEventListener("storage", loadCompanyProfile);

    return () => {
      window.removeEventListener("auto-pro-ia:company-profile-updated", loadCompanyProfile);
      window.removeEventListener("storage", loadCompanyProfile);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCurrentUser() {
      try {
        const response = await fetchWithTimeout("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json() as { user?: CurrentUser | null };
        if (mounted) {
          setCurrentUser(data.user ?? null);
        }
      } catch {
        if (mounted) {
          setCurrentUser(null);
        }
      }
    }

    loadCurrentUser();

    return () => {
      mounted = false;
    };
  }, []);

  function openNewLead() {
    if (onNewLead) {
      onNewLead();
      return;
    }

    setLeadDraft(emptyLead);
    setShowFallbackModal(true);
  }

  async function saveFallbackLead() {
    if (!leadDraft.name.trim()) {
      return;
    }

    if (!leadDraft.phone.trim()) {
      window.alert("Informe o WhatsApp do lead para salvar.");
      return;
    }

    const payload = {
      name: leadDraft.name.trim(),
      phone: leadDraft.phone.trim(),
      origin: leadDraft.origin,
      status: leadDraft.status,
      temperature: leadDraft.temperature,
      sentiment: leadDraft.sentiment,
      lastMessage: leadDraft.lastMessage.trim() || "Lead cadastrado manualmente.",
      interest: leadDraft.notes.trim() || undefined
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nao foi possivel salvar o lead.");
      }

      window.dispatchEvent(new Event("auto-pro-ia:leads-updated"));
      setShowFallbackModal(false);
      setLeadDraft(emptyLead);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel salvar o lead.");
    }
  }

  function exitApp() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/";
    });
  }

  function submitGlobalSearch() {
    const normalized = globalSearch.trim();
    if (!normalized) {
      return;
    }

    window.location.href = `/leads?search=${encodeURIComponent(normalized)}`;
  }

  return (
    <>
      <header className="sticky top-0 z-[100] border-b border-white/[0.06] bg-[#080d16]/88 px-4 py-3 shadow-[0_18px_58px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:px-6">
        <div className="flex min-h-[76px] items-center gap-4 rounded-[26px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(17,24,39,0.82),rgba(8,13,22,0.92))] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] lg:px-5">
        <div className="min-w-[180px] flex-1">
          <h1 className="truncate text-[22px] font-black leading-tight tracking-[-0.01em] text-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-1 truncate text-sm font-semibold text-slate-300/78">{subtitle}</p>
          ) : null}
        </div>

        {extraControls ? <div className="hidden shrink-0 items-center lg:flex">{extraControls}</div> : null}

        <div className="hidden w-full max-w-[520px] lg:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/80" />
            {hasInteractiveSearch ? (
              <input
                value={searchValue ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar leads, conversas, clientes..."
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0B1120]/82 pl-10 pr-4 text-sm text-foreground outline-none transition duration-200 placeholder:text-muted-foreground/70 hover:border-white/[0.18] focus:border-primary/55 focus:bg-[#111827] focus:ring-4 focus:ring-primary/10"
              />
            ) : (
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitGlobalSearch();
                  }
                }}
                placeholder="Buscar leads, conversas, clientes..."
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0B1120]/82 pl-10 pr-4 text-sm text-foreground outline-none transition duration-200 placeholder:text-muted-foreground/70 hover:border-white/[0.18] focus:border-primary/55 focus:bg-[#111827] focus:ring-4 focus:ring-primary/10"
              />
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="group/ai-status relative">
            <button
              type="button"
              className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-2xl border border-[#38BDF8]/35 bg-[#0B5FA5]/15 px-3 text-xs font-black text-blue-50 shadow-[inset_0_0_18px_rgba(56,189,248,0.08),0_0_0_1px_rgba(56,189,248,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#38BDF8]/60 hover:bg-[#0B5FA5]/22 active:translate-y-0"
              aria-label="Status da IA"
            >
              <Bot className="relative z-10 size-4 text-[#38BDF8]" />
              <span className="relative z-10">Status da IA</span>
              <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-[#38BDF8]/20 bg-[#061427]/72 px-2 py-0.5 text-[10px] font-black text-blue-50">
                <span className="ai-active-dot size-2 rounded-full bg-[#22C55E]" />
                Ativo
              </span>
            </button>
            <div className="pointer-events-none absolute right-0 top-10 z-[120] w-72 translate-y-2 pt-2 opacity-0 transition-all duration-200 group-hover/ai-status:pointer-events-auto group-hover/ai-status:translate-y-0 group-hover/ai-status:opacity-100">
              <div className="rounded-2xl border border-[#38BDF8]/25 bg-[#07111f]/96 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.42),0_0_36px_rgba(56,189,248,0.10)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-black">
                    <Bot className="size-4 text-[#38BDF8]" />
                    Status da IA
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#38BDF8]/20 bg-[#0B5FA5]/16 px-2 py-0.5 text-[10px] font-black">
                    <span className="ai-active-dot size-2 rounded-full bg-[#22C55E]" />
                    Ativo
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">18 conversas em atendimento automatico. A IA esta respondendo novos leads e mantendo contexto para repasse humano.</p>
              </div>
            </div>
          </div>
          <div className="group/notifications relative">
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              aria-label="Abrir notificacoes"
              className="ap-button-ghost relative grid size-10 place-items-center rounded-2xl text-primary transition duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Bell className="size-4" />
              {notifications.length > 0 ? (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />
              ) : null}
            </button>

            <div className="pointer-events-none absolute right-0 top-10 z-[120] w-80 translate-y-2 pt-2 opacity-0 transition-all duration-200 group-hover/notifications:pointer-events-auto group-hover/notifications:translate-y-0 group-hover/notifications:opacity-100">
              <div className="rounded-2xl border border-white/10 bg-[#0B1120]/[0.98] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.54)] backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-sm font-bold">Notificacoes</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {notifications.length} novas
                  </span>
                </div>
                <div className="space-y-1.5">
                  {notifications.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-xs leading-5 text-muted-foreground">
                      Sem notificacoes reais no momento.
                    </div>
                  ) : notifications.slice(0, 3).map((notification) => {
                    const Icon = notification.icon;

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => setShowNotificationsModal(true)}
                        className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.055]"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/[0.055]">
                          <Icon className={`size-4 ${notification.tone}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{notification.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                            {notification.description}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{notification.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="group/profile relative">
            <button
              type="button"
              className="ap-button-primary grid size-10 place-items-center overflow-hidden rounded-2xl text-xs font-bold transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
              aria-label="Abrir perfil"
            >
              {companyProfile.logo ? (
                <img src={companyProfile.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsFromName(companyProfile.name || "Auto Pro").slice(0, 2)
              )}
            </button>

            <div className="pointer-events-none absolute right-0 top-10 z-[120] w-64 translate-y-2 pt-2 opacity-0 transition-all duration-200 group-hover/profile:pointer-events-auto group-hover/profile:translate-y-0 group-hover/profile:opacity-100">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1120]/[0.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.54)] backdrop-blur-xl">
                <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-xs font-bold text-primary-foreground">
                    {companyProfile.logo ? (
                      <img src={companyProfile.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initialsFromName(companyProfile.name || "Auto Pro").slice(0, 2)
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{companyProfile.name}</p>
                    <p className="text-xs text-muted-foreground">Perfil da empresa</p>
                  </div>
                </div>

                <div className="mx-1 mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/15 text-xs font-black text-primary">
                      {initialsFromName(currentUser?.name || "Usuario").slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{currentUser?.name ?? "Usuario logado"}</p>
                      <p className="truncate text-[11px] font-semibold text-muted-foreground">{currentUser?.email ?? "Sessao ativa"}</p>
                    </div>
                  </div>
                  <div className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                    {(currentUser?.role ?? "usuario").replaceAll("_", " ")}
                  </div>
                </div>

                <Link
                  href="/configuracoes"
                  className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-white/[0.055] hover:text-foreground"
                  title={currentUser ? `Visitar perfil de ${currentUser.name}` : "Visitar perfil"}
                >
                  <UserRound className="size-4 text-primary" />
                  <span className="min-w-0 flex-1 truncate">Visitar perfil</span>
                  {currentUser ? <span className="max-w-[92px] truncate text-xs text-muted-foreground">{currentUser.name}</span> : null}
                </Link>
                <button
                  type="button"
                  onClick={exitApp}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                >
                  <LogOut className="size-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </header>

      {showFallbackModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-panel">
            <div className="border-b border-border p-5">
              <h2 className="text-lg font-bold">Novo lead</h2>
              <p className="mt-1 text-sm text-muted-foreground">Salve o lead para criar um card no Kanban.</p>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Nome</span>
                <input
                  value={leadDraft.name}
                  onChange={(event) => setLeadDraft((current) => ({ ...current, name: event.target.value }))}
                  className="kanban-input [&_option]:bg-[#0b1422] [&_option]:text-white"
                  placeholder="Nome do lead"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">WhatsApp</span>
                <input
                  value={leadDraft.phone}
                  onChange={(event) => setLeadDraft((current) => ({ ...current, phone: event.target.value }))}
                  className="kanban-input [&_option]:bg-[#0b1422] [&_option]:text-white"
                  placeholder="+55 75 99999-0000"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Origem</span>
                <select
                  value={leadDraft.origin}
                  onChange={(event) => setLeadDraft((current) => ({ ...current, origin: event.target.value }))}
                  className="kanban-input [&_option]:bg-[#0b1422] [&_option]:text-white"
                >
                  <option>WhatsApp</option>
                  <option>Meta Ads</option>
                  <option>Google Ads</option>
                  <option>Instagram</option>
                  <option>Indicacao</option>
                  <option>Site</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Etapa</span>
                <select
                  value={leadDraft.status}
                  onChange={(event) => setLeadDraft((current) => ({ ...current, status: event.target.value }))}
                  className="kanban-input"
                >
                  <optgroup label="Entrada">
                    <option value="novo">Novo Lead</option>
                    <option value="ia">IA Atendendo</option>
                  </optgroup>
                  <optgroup label="Conversao">
                    <option value="atendimento">Em Atendimento</option>
                    <option value="followup">Follow up</option>
                    <option value="perdido">Sem Retorno</option>
                  </optgroup>
                  <optgroup label="Fechamento">
                    <option value="matricula_pendente">Matricula Pendente</option>
                    <option value="matricula_realizada">Matricula Realizada</option>
                  </optgroup>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Sentimento</span>
                <select
                  value={leadDraft.sentiment}
                  onChange={(event) => setLeadDraft((current) => ({ ...current, sentiment: event.target.value }))}
                  className="kanban-input"
                >
                  <option value="positivo">Positivo</option>
                  <option value="neutro">Neutro</option>
                  <option value="duvida">Duvida</option>
                  <option value="negativo">Negativo</option>
                </select>
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Observacao</span>
                <textarea
                  value={leadDraft.lastMessage}
                  onChange={(event) => setLeadDraft((current) => ({ ...current, lastMessage: event.target.value }))}
                  className="kanban-input min-h-24 resize-none"
                  placeholder="Resumo da conversa ou interesse do lead"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-5">
              <button
                type="button"
                onClick={() => setShowFallbackModal(false)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveFallbackLead}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-glow transition hover:-translate-y-0.5"
              >
                Salvar lead
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showNotificationsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-card shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
            <div className="flex items-start gap-4 border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-bold">Notificacoes</h2>
                <p className="mt-1 text-sm text-muted-foreground">Atualizacoes recentes do atendimento e vendas.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationsModal(false)}
                className="ml-auto grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                aria-label="Fechar notificacoes"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[62vh] space-y-2 overflow-y-auto p-4 scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 text-sm text-muted-foreground">
                  Nenhuma notificacao real registrada agora.
                </div>
              ) : notifications.map((notification) => {
                const Icon = notification.icon;

                return (
                  <article
                    key={notification.id}
                    className="flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white/[0.055]"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.055]">
                      <Icon className={`size-5 ${notification.tone}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold leading-5">{notification.title}</h3>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs font-bold text-muted-foreground">
                          {notification.time}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
