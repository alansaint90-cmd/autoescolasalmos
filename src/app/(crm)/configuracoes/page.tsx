"use client";

import {
  AlertCircle,
  BellRing,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  DollarSign,
  Eye,
  EyeOff,
  HardDrive,
  ImagePlus,
  KeyRound,
  Loader2,
  Maximize2,
  MessageCircle,
  Moon,
  PauseCircle,
  Plus,
  PlayCircle,
  Plug,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  X,
  UserCheck,
  Users
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { aiBusinessSettingsKey, defaultAiBusinessSettings, type AiBusinessSettings } from "@/lib/ai-business-settings";
import {
  defaultIntegrationSettings,
  type IntegrationSettings,
  type IntegrationStatus
} from "@/lib/integration-settings";
import { defaultRolePermissions, type PermissionKey, type PermissionRecord, type PermissionRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type TabId = "empresa" | "usuarios" | "permissoes" | "integracoes" | "ia" | "seguranca" | "preferencias";

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "permissoes", label: "Permissoes", icon: ShieldCheck },
  { id: "integracoes", label: "Integracoes", icon: Plug },
  { id: "ia", label: "IA Comercial", icon: Bot },
  { id: "seguranca", label: "Senha", icon: KeyRound },
  { id: "preferencias", label: "Preferencias", icon: Settings }
];

type CompanyProfile = {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  logo?: string;
};

const COMPANY_PROFILE_STORAGE_KEY = "auto-pro-ia:company-profile";
const THEME_STORAGE_KEY = "auto-pro-ia:theme";
const USERS_STORAGE_KEY = "auto-pro-ia:users";
const PREFERENCES_STORAGE_KEY = "auto-pro-ia:preferences";

const defaultCompanyProfile: CompanyProfile = {
  name: "AutoEscola Pro",
  cnpj: "00.000.000/0001-00",
  email: "contato@autoescolapro.com.br",
  phone: "+55 11 99999-0000",
  address: "Av. Paulista, 1000",
  city: "Sao Paulo, SP"
};

const fields: Array<{ key: keyof Omit<CompanyProfile, "logo">; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "cnpj", label: "CNPJ" },
  { key: "email", label: "Email comercial" },
  { key: "phone", label: "Telefone" },
  { key: "address", label: "Endereco" },
  { key: "city", label: "Cidade" }
];

type RoleId = PermissionRole;

type UserRecord = {
  initials: string;
  name: string;
  email: string;
  phone: string;
  role: RoleId;
  position: string;
  scope: "Todos os leads" | "Somente atribuídos" | "Financeiro" | "Sistema";
  status: "Ativo" | "Inativo";
};

const roles: Array<{
  id: RoleId;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: "admin", label: "Superadmin", description: "Controle total da autoescola.", icon: ShieldCheck },
  { id: "gerente", label: "Gerente", description: "Coordena funil, equipe e relatorios. Limite: 4 cadastros.", icon: BriefcaseBusiness },
  { id: "sdr", label: "Atendente", description: "Atende leads, assume conversas e faz follow-up. Limite: 4 cadastros.", icon: UserCheck },
  { id: "bot", label: "IA", description: "Usuario tecnico da inteligencia artificial.", icon: Bot }
];

const defaultUsers: UserRecord[] = [
  { initials: "SA", name: "Superadmin", email: "admin@autopro.ia", phone: "+55 75 99999-0001", role: "admin", position: "Dono / gestor", scope: "Todos os leads", status: "Ativo" },
  { initials: "GV", name: "Carla Vendas", email: "gerente1@autopro.ia", phone: "+55 75 99999-0002", role: "gerente", position: "Gerente", scope: "Todos os leads", status: "Ativo" },
  { initials: "AT", name: "Julio Operador", email: "atendente1@autopro.ia", phone: "+55 75 99999-0003", role: "sdr", position: "Atendente / SDR", scope: "Somente atribuídos", status: "Ativo" },
  { initials: "IA", name: defaultAiBusinessSettings.agentName, email: "ia@autopro.ia", phone: "Sistema", role: "bot", position: "IA", scope: "Sistema", status: "Ativo" }
];

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "US";
}

function aiNameFromStorage() {
  try {
    const stored = window.localStorage.getItem(aiBusinessSettingsKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AiBusinessSettings>;
      return parsed.agentName?.trim() || defaultAiBusinessSettings.agentName;
    }
  } catch {
    return defaultAiBusinessSettings.agentName;
  }

  return defaultAiBusinessSettings.agentName;
}

const defaultPermissions = defaultRolePermissions;

const defaultPreferences = [
  { key: "sellerScope", title: "Vendedor ve somente leads atribuidos", description: "Closer e SDR ficam restritos aos proprios leads.", enabled: true },
  { key: "managerAllLeads", title: "Gerente ve toda a operacao", description: "Permite visao completa do funil e conversas.", enabled: true },
  { key: "sdrDeleteBlocked", title: "SDR nao pode excluir lead", description: "Evita perda acidental de oportunidades.", enabled: true },
  { key: "soundNotifications", title: "Notificacoes por som", description: "Tocar som ao receber novo lead.", enabled: false },
  { key: "roundRobin", title: "Atribuicao automatica", description: "Distribuir leads novos por round-robin.", enabled: true },
  { key: "aiAfterHours", title: "IA responde fora do horario", description: "Mantem atendimento automatico quando a equipe estiver offline.", enabled: true },
  { key: "humanCanAssume", title: "Atendente pode assumir conversas", description: "Permite pausar IA em conversas sensiveis.", enabled: true },
  { key: "exportRestricted", title: "Exportacao restrita a gestao", description: "Somente Admin, Gerente e Financeiro exportam relatorios.", enabled: true },
  { key: "dailySummary", title: "Resumo diario por email", description: "Receba KPIs todo dia as 8h.", enabled: false }
];

const aiMessages = [
  { label: "Saudacao inicial", value: "Ola! 👋 Sou a Ana, da AutoEscola Pro. Como posso te ajudar?" },
  { label: "Fora do horario", value: "Estamos fora de horario, retornaremos amanha as 8h." },
  { label: "Encerramento", value: "Obrigada pelo contato! Ate logo. 🚗" }
];

type IntegrationEnvironmentStatus = {
  openai: {
    apiKey: boolean;
    model: boolean;
  };
  evolution: {
    baseUrl: boolean;
    apiKey: boolean;
    instanceName: boolean;
    webhookSecret: boolean;
  };
  minio: {
    endpoint: boolean;
    accessKey: boolean;
    secretKey: boolean;
    bucket: boolean;
  };
};

type IntegrationEnvironmentValues = {
  openai?: Partial<Pick<IntegrationSettings["openai"], "apiKey" | "model">>;
  evolution?: Partial<Pick<IntegrationSettings["evolution"], "baseUrl" | "apiKey" | "instanceName" | "webhookSecret">>;
  minio?: Partial<Pick<IntegrationSettings["minio"], "endpoint" | "accessKey" | "secretKey" | "bucket" | "region">>;
};

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("empresa");

  return (
    <>
      <Topbar title="Configuracoes" subtitle="Personalize sua operacao e integracoes" />

      <main className="flex-1 overflow-y-auto bg-background p-6 text-foreground">
        <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
          <aside className="space-y-2">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex h-12 w-full items-center gap-3 rounded-[18px] px-4 text-left text-sm transition",
                    active
                      ? "border border-primary/55 bg-primary/15 font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <tab.icon className={active ? "text-primary" : "text-muted-foreground"} size={18} />
                  {tab.label}
                </button>
              );
            })}
          </aside>

          {activeTab === "empresa" ? <EmpresaPanel /> : null}
          {activeTab === "usuarios" ? <UsuariosPanel /> : null}
          {activeTab === "permissoes" ? <PermissoesPanel /> : null}
          {activeTab === "integracoes" ? <IntegracoesPanel /> : null}
          {activeTab === "ia" ? <IaComercialPanel /> : null}
          {activeTab === "seguranca" ? <SegurancaPanel /> : null}
          {activeTab === "preferencias" ? <PreferenciasPanel /> : null}
        </div>
      </main>
    </>
  );
}

function EmpresaPanel() {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COMPANY_PROFILE_STORAGE_KEY);
      if (stored) {
        setCompanyProfile({ ...defaultCompanyProfile, ...(JSON.parse(stored) as CompanyProfile) });
      }
    } catch {
      setCompanyProfile(defaultCompanyProfile);
    }
  }, []);

  function updateField(key: keyof Omit<CompanyProfile, "logo">, value: string) {
    setCompanyProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function uploadLogo(file?: File) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCompanyProfile((current) => ({ ...current, logo: String(reader.result) }));
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setCompanyProfile((current) => {
      const { logo, ...profileWithoutLogo } = current;
      return profileWithoutLogo;
    });
    setSaved(false);
  }

  function saveCompanyProfile() {
    window.localStorage.setItem(COMPANY_PROFILE_STORAGE_KEY, JSON.stringify(companyProfile));
    window.dispatchEvent(new Event("auto-pro-ia:company-profile-updated"));
    setSaved(true);
  }

  return (
    <section className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <h2 className="text-lg font-extrabold tracking-normal">Perfil da empresa</h2>

      <form
        className="mt-6 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveCompanyProfile();
        }}
      >
        <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[22px] border border-white/10 bg-primary text-lg font-black text-primary-foreground shadow-glow">
              {companyProfile.logo ? (
                <img src={companyProfile.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                companyProfile.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">Logo da empresa</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Envie a logo que deve aparecer no topo do sistema no lugar do avatar atual.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:-translate-y-0.5">
                <ImagePlus size={16} />
                Fazer upload
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => uploadLogo(event.target.files?.[0])}
                  className="sr-only"
                />
              </label>
              {companyProfile.logo ? (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-red-500/30 px-4 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                  Remover
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-x-5 gap-y-6 xl:grid-cols-2">
          {fields.map((field) => (
            <label key={field.label} className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {field.label}
              </span>
              <input
                value={companyProfile[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
                className="h-10 w-full rounded-[14px] border border-border bg-input/65 px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex h-10 items-center justify-center rounded-[14px] bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-glow">
            Salvar alteracoes
          </button>
          {saved ? <span className="text-sm font-semibold text-success">Perfil atualizado</span> : null}
        </div>
      </form>
    </section>
  );
}

function UsuariosPanel() {
  const [teamUsers, setTeamUsers] = useState<UserRecord[]>(defaultUsers);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USERS_STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as UserRecord[]) : defaultUsers;
      const users = Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultUsers;
      const agentName = aiNameFromStorage();
      setTeamUsers(syncIaUser(users, agentName));
    } catch {
      setTeamUsers(syncIaUser(defaultUsers, aiNameFromStorage()));
    }
  }, []);

  function syncIaUser(users: UserRecord[], agentName: string) {
    const allowedRoles: RoleId[] = ["admin", "gerente", "sdr", "bot"];
    const normalized = users
      .filter((user) => allowedRoles.includes(user.role))
      .map((user) => ({
        ...user,
        role: user.role === "closer" ? "sdr" : user.role,
        initials: initialsFromName(user.name)
      }));
    const withoutIa = normalized.filter((user) => user.role !== "bot");
    return [
      ...withoutIa,
      { initials: "IA", name: agentName, email: "ia@autopro.ia", phone: "Sistema", role: "bot" as RoleId, position: "IA", scope: "Sistema" as UserRecord["scope"], status: "Ativo" as const }
    ];
  }

  function persistUsers(nextUsers: UserRecord[]) {
    const agentName = aiNameFromStorage();
    const synced = syncIaUser(nextUsers, agentName);
    setTeamUsers(synced);
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(synced));
    setSaved(true);
  }

  function updateUser(email: string, key: keyof UserRecord, value: string) {
    setTeamUsers((current) =>
      current.map((user) => {
        if (user.email !== email || user.role === "admin" || user.role === "bot") return user;
        const updated = { ...user, [key]: value };
        return key === "name" ? { ...updated, initials: initialsFromName(value) } : updated;
      })
    );
    setSaved(false);
  }

  function addUser(role: "gerente" | "sdr") {
    setTeamUsers((current) => {
      const roleCount = current.filter((user) => user.role === role).length;
      if (roleCount >= 4) return current;
      const label = role === "gerente" ? "Gerente" : "Atendente";
      return [
        ...current.filter((user) => user.role !== "bot"),
        {
          initials: role === "gerente" ? "GE" : "AT",
          name: `${label} ${roleCount + 1}`,
          email: `${role}${roleCount + 1}@autopro.ia`,
          phone: "+55 75 99999-0000",
          role,
          position: role === "gerente" ? "Gerente" : "Atendente / SDR",
          scope: role === "gerente" ? "Todos os leads" : "Somente atribuídos",
          status: "Ativo"
        },
        current.find((user) => user.role === "bot") ?? defaultUsers.find((user) => user.role === "bot")!
      ];
    });
    setSaved(false);
  }

  function removeUser(email: string) {
    setTeamUsers((current) => current.filter((user) => user.email !== email || user.role === "admin" || user.role === "bot"));
    setSaved(false);
  }

  const gerenteCount = teamUsers.filter((user) => user.role === "gerente").length;
  const atendenteCount = teamUsers.filter((user) => user.role === "sdr").length;

  return (
    <section className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-normal">Usuarios e papeis</h2>
          <p className="mt-1 text-sm text-muted-foreground">Defina quem acessa o CRM e qual papel cada pessoa possui.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => addUser("gerente")} disabled={gerenteCount >= 4} className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} />
            Gerente {gerenteCount}/4
          </button>
          <button type="button" onClick={() => addUser("sdr")} disabled={atendenteCount >= 4} className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-primary/30 px-4 text-sm font-extrabold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} />
            Atendente {atendenteCount}/4
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {teamUsers.map((user) => {
          const role = roles.find((item) => item.id === user.role) ?? roles[0];
          const RoleIcon = role.icon;

          return (
          <div key={user.email} className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="grid items-center gap-4 xl:grid-cols-[1.1fr_0.8fr_0.8fr_0.6fr_auto]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary font-mono text-sm font-extrabold text-primary-foreground shadow-glow">
                {user.initials}
              </div>
              <div className="min-w-0">
                {user.role === "admin" || user.role === "bot" ? (
                  <p className="truncate text-sm font-extrabold">{user.name}</p>
                ) : (
                  <input
                    value={user.name}
                    onChange={(event) => updateUser(user.email, "name", event.target.value)}
                    className="h-9 w-full rounded-[12px] border border-border bg-input/65 px-3 text-sm font-extrabold outline-none focus:border-primary/60"
                  />
                )}
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                {user.role === "admin" || user.role === "bot" ? (
                  <p className="truncate text-xs text-muted-foreground">{user.phone}</p>
                ) : (
                  <input
                    value={user.phone}
                    onChange={(event) => updateUser(user.email, "phone", event.target.value)}
                    className="mt-1 h-8 w-full rounded-[10px] border border-border bg-input/45 px-3 text-xs font-semibold outline-none focus:border-primary/60"
                  />
                )}
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Papel</span>
              <div className="relative">
                <RoleIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <select
                  value={user.role}
                  onChange={(event) => updateUser(user.email, "role", event.target.value)}
                  disabled={user.role === "admin" || user.role === "bot"}
                  className="h-10 w-full rounded-[14px] border border-border bg-input/65 pl-9 pr-3 text-sm font-bold outline-none focus:border-primary/60"
                >
                  {roles.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Escopo</span>
              <select
                value={user.scope}
                onChange={(event) => updateUser(user.email, "scope", event.target.value)}
                className="h-10 rounded-[14px] border border-border bg-input/65 px-3 text-sm font-bold outline-none focus:border-primary/60"
              >
                <option>Todos os leads</option>
                <option>Somente atribuídos</option>
                <option>Financeiro</option>
                <option>Sistema</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Status</span>
              <select
                value={user.status}
                onChange={(event) => updateUser(user.email, "status", event.target.value)}
                className={cn(
                  "h-10 rounded-[14px] border border-border bg-input/65 px-3 text-sm font-bold outline-none focus:border-primary/60",
                  user.status === "Ativo" ? "text-success" : "text-muted-foreground"
                )}
              >
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => removeUser(user.email)}
              disabled={user.role === "admin" || user.role === "bot"}
              className="inline-flex h-10 items-center justify-center rounded-[14px] border border-red-500/25 px-3 text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Remover usuario"
            >
              <Trash2 size={16} />
            </button>
            </div>
          </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => persistUsers(teamUsers)} className="inline-flex h-10 items-center justify-center rounded-[14px] bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-glow">
          Salvar usuarios
        </button>
        {saved ? <span className="text-sm font-semibold text-success">Usuarios salvos</span> : null}
      </div>
    </section>
  );
}

function PermissoesPanel() {
  const [permissionRows, setPermissionRows] = useState(defaultPermissions);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      try {
        const response = await fetch("/api/settings/permissions", { cache: "no-store" });
        const payload = await response.json() as { permissions?: PermissionRecord[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Nao foi possivel carregar as permissoes.");
        }

        if (active && payload.permissions?.length) {
          setPermissionRows(payload.permissions);
          setStatus("idle");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar as permissoes.");
          setStatus("error");
        }
      }
    }

    loadPermissions();

    return () => {
      active = false;
    };
  }, []);

  function togglePermission(permissionKey: PermissionKey, roleId: RoleId) {
    setPermissionRows((current) =>
      current.map((permission) =>
        permission.key === permissionKey ? { ...permission, [roleId]: !permission[roleId] } : permission
      )
    );
    setStatus("idle");
    setMessage("");
  }

  async function savePermissions() {
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/settings/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permissionRows })
      });
      const payload = await response.json() as { permissions?: PermissionRecord[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel salvar as permissoes.");
      }

      if (payload.permissions?.length) {
        setPermissionRows(payload.permissions);
      }

      setStatus("saved");
      setMessage("Permissoes salvas e aplicadas nas APIs.");
      window.setTimeout(() => setStatus("idle"), 2200);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar as permissoes.");
    }
  }

  return (
    <section className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <div className="mb-6">
        <h2 className="text-lg font-extrabold tracking-normal">Matriz RBAC de permissoes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle o que cada papel pode acessar em Leads, Conversas, Kanban, Relatorios, IA e Administracao.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <div key={role.id} className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <role.icon size={17} />
              </div>
              <p className="font-extrabold">{role.label}</p>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{role.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Modulo
              </th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Permissao
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="pb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionRows.map((permission) => (
              <tr key={permission.key} className="border-b border-border last:border-b-0">
                <td className="py-4">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-black text-muted-foreground">
                    {permission.module}
                  </span>
                </td>
                <td className="py-4">
                  <p className="font-extrabold">{permission.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{permission.description}</p>
                </td>
                {roles.map((role) => (
                  <td key={role.id} className="py-4 text-center">
                    <input
                      type="checkbox"
                      checked={permission[role.id]}
                      onChange={() => togglePermission(permission.key, role.id)}
                      aria-label={`${permission.label} - ${role.label}`}
                      className="size-4 rounded border-border accent-primary"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={savePermissions}
          disabled={status === "saving" || status === "loading"}
          className="inline-flex h-10 items-center justify-center rounded-[14px] bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Salvando..." : "Salvar permissoes"}
        </button>
        {status === "loading" ? <span className="text-sm font-semibold text-muted-foreground">Carregando permissoes...</span> : null}
        {message ? (
          <span className={cn("text-sm font-semibold", status === "error" ? "text-destructive" : "text-success")}>
            {message}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function IntegracoesPanel() {
  const [settings, setSettings] = useState<IntegrationSettings>(defaultIntegrationSettings);
  const [environmentStatus, setEnvironmentStatus] = useState<IntegrationEnvironmentStatus | null>(null);
  const [environmentValues, setEnvironmentValues] = useState<IntegrationEnvironmentValues | null>(null);
  const [canRevealSecrets, setCanRevealSecrets] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("loading");
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadIntegrations() {
      setStatus("loading");
      try {
        const response = await fetch("/api/settings/integrations", { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as {
          settings?: IntegrationSettings;
          environment?: IntegrationEnvironmentStatus;
          environmentValues?: IntegrationEnvironmentValues | null;
          canRevealSecrets?: boolean;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Nao foi possivel carregar integracoes.");
        }

        if (active && data.settings) {
          setSettings(data.settings);
          setEnvironmentStatus(data.environment ?? null);
          setEnvironmentValues(data.environmentValues ?? null);
          setCanRevealSecrets(Boolean(data.canRevealSecrets));
          setStatus("idle");
        }
      } catch (error) {
        if (active) {
          setSettings(defaultIntegrationSettings);
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar integracoes.");
        }
      }
    }

    loadIntegrations();

    return () => {
      active = false;
    };
  }, []);

  function updateIntegration<T extends keyof IntegrationSettings, K extends keyof IntegrationSettings[T]>(
    service: T,
    key: K,
    value: IntegrationSettings[T][K]
  ) {
    setSettings((current) => ({
      ...current,
      [service]: {
        ...current[service],
        [key]: value,
        status: "pending"
      }
    }));
    setSaved(false);
  }

  function revealEnvironmentSecrets() {
    if (!canRevealSecrets) {
      setShowSecrets(false);
      setMessage("Somente o superadmin pode visualizar chaves sensiveis.");
      setStatus("error");
      return;
    }

    setShowSecrets((value) => {
      const nextValue = !value;
      if (nextValue && environmentValues) {
        setSettings((current) => ({
          openai: {
            ...current.openai,
            apiKey: current.openai.apiKey || environmentValues.openai?.apiKey || "",
            model: current.openai.model || environmentValues.openai?.model || current.openai.model
          },
          evolution: {
            ...current.evolution,
            baseUrl: current.evolution.baseUrl || environmentValues.evolution?.baseUrl || "",
            apiKey: current.evolution.apiKey || environmentValues.evolution?.apiKey || "",
            instanceName: current.evolution.instanceName || environmentValues.evolution?.instanceName || "",
            webhookSecret: current.evolution.webhookSecret || environmentValues.evolution?.webhookSecret || ""
          },
          minio: {
            ...current.minio,
            endpoint: current.minio.endpoint || environmentValues.minio?.endpoint || "",
            accessKey: current.minio.accessKey || environmentValues.minio?.accessKey || "",
            secretKey: current.minio.secretKey || environmentValues.minio?.secretKey || "",
            bucket: current.minio.bucket || environmentValues.minio?.bucket || current.minio.bucket,
            region: current.minio.region || environmentValues.minio?.region || current.minio.region
          }
        }));
      }
      setStatus("idle");
      setMessage("");
      return nextValue;
    });
  }

  function testIntegration(service: keyof IntegrationSettings) {
    const current = settings[service];
    const envConfigured = environmentStatus?.[service];
    const required = Object.entries(current)
      .filter(([key]) => !["status", "organization", "webhookSecret", "region", "useSSL"].includes(key))
      .every(([key, value]) => Boolean(String(value).trim()) || Boolean(envConfigured?.[key as keyof typeof envConfigured]));

    setSettings((items) => ({
      ...items,
      [service]: {
        ...items[service],
        status: required ? "connected" : "error"
      }
    }));
  }

  async function saveIntegrations() {
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      });
      const data = await response.json().catch(() => ({})) as { settings?: IntegrationSettings; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel salvar integracoes.");
      }

      if (data.settings) setSettings(data.settings);
      setSaved(true);
      setStatus("idle");
      setMessage("Conexoes salvas com sucesso.");
    } catch (error) {
      setSaved(false);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar integracoes.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-normal">Conexoes de API</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure as credenciais que o Auto Pro IA usara para IA, WhatsApp e armazenamento de midias.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={revealEnvironmentSecrets}
              disabled={status === "loading"}
              title={canRevealSecrets ? "Mostrar chaves sensiveis" : "Disponivel somente para superadmin"}
              className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-white/10 px-4 text-sm font-bold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
              {showSecrets ? "Ocultar chaves" : "Mostrar chaves"}
            </button>
            <button
              type="button"
              onClick={saveIntegrations}
              disabled={status === "saving" || status === "loading"}
              className="inline-flex h-10 items-center justify-center rounded-[14px] bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-glow"
            >
              {status === "saving" ? "Salvando..." : "Salvar conexoes"}
            </button>
          </div>
        </div>
        {status === "loading" ? <p className="mt-3 text-sm font-semibold text-muted-foreground">Carregando conexoes...</p> : null}
        {message ? (
          <p className={cn("mt-3 text-sm font-semibold", status === "error" ? "text-destructive" : "text-success")}>
            {message}
          </p>
        ) : null}
        {saved && !message ? <p className="mt-3 text-sm font-semibold text-success">Conexoes salvas com sucesso.</p> : null}
      </div>

      <IntegrationCard
        title="OpenAI API"
        description="Usada para respostas automaticas, analise de intencao, sugestoes e resumo de conversas."
        icon={Bot}
        status={settings.openai.status}
        onTest={() => testIntegration("openai")}
      >
        <IntegrationInput
          label="API Key"
          value={settings.openai.apiKey}
          secret={!showSecrets}
          placeholder="sk-..."
          envConfigured={environmentStatus?.openai.apiKey}
          onChange={(value) => updateIntegration("openai", "apiKey", value)}
        />
        <IntegrationInput
          label="Modelo"
          value={settings.openai.model}
          placeholder="gpt-4.1-mini"
          envConfigured={environmentStatus?.openai.model}
          onChange={(value) => updateIntegration("openai", "model", value)}
        />
        <IntegrationInput
          label="Organization ID"
          value={settings.openai.organization}
          placeholder="Opcional"
          onChange={(value) => updateIntegration("openai", "organization", value)}
        />
      </IntegrationCard>

      <IntegrationCard
        title="Evolution API"
        description="Conecta o WhatsApp para receber webhooks, enviar mensagens e controlar instancias."
        icon={Server}
        status={settings.evolution.status}
        onTest={() => testIntegration("evolution")}
      >
        <IntegrationInput
          label="URL base"
          value={settings.evolution.baseUrl}
          placeholder="https://evolution.seudominio.com"
          envConfigured={environmentStatus?.evolution.baseUrl}
          onChange={(value) => updateIntegration("evolution", "baseUrl", value)}
        />
        <IntegrationInput
          label="API Key"
          value={settings.evolution.apiKey}
          secret={!showSecrets}
          placeholder="Chave da Evolution API"
          envConfigured={environmentStatus?.evolution.apiKey}
          onChange={(value) => updateIntegration("evolution", "apiKey", value)}
        />
        <IntegrationInput
          label="Nome da instancia"
          value={settings.evolution.instanceName}
          placeholder="auto-pro-ia"
          envConfigured={environmentStatus?.evolution.instanceName}
          onChange={(value) => updateIntegration("evolution", "instanceName", value)}
        />
        <IntegrationInput
          label="Webhook secret"
          value={settings.evolution.webhookSecret}
          secret={!showSecrets}
          placeholder="Opcional"
          envConfigured={environmentStatus?.evolution.webhookSecret}
          onChange={(value) => updateIntegration("evolution", "webhookSecret", value)}
        />
      </IntegrationCard>

      <IntegrationCard
        title="MinIO"
        description="Armazena audios, imagens, videos e anexos das respostas rapidas e conversas."
        icon={HardDrive}
        status={settings.minio.status}
        onTest={() => testIntegration("minio")}
      >
        <IntegrationInput
          label="Endpoint"
          value={settings.minio.endpoint}
          placeholder="https://minio.seudominio.com"
          envConfigured={environmentStatus?.minio.endpoint}
          onChange={(value) => updateIntegration("minio", "endpoint", value)}
        />
        <IntegrationInput
          label="Access key"
          value={settings.minio.accessKey}
          secret={!showSecrets}
          placeholder="MINIO_ACCESS_KEY"
          envConfigured={environmentStatus?.minio.accessKey}
          onChange={(value) => updateIntegration("minio", "accessKey", value)}
        />
        <IntegrationInput
          label="Secret key"
          value={settings.minio.secretKey}
          secret={!showSecrets}
          placeholder="MINIO_SECRET_KEY"
          envConfigured={environmentStatus?.minio.secretKey}
          onChange={(value) => updateIntegration("minio", "secretKey", value)}
        />
        <IntegrationInput
          label="Bucket"
          value={settings.minio.bucket}
          placeholder="autoproia-media"
          envConfigured={environmentStatus?.minio.bucket}
          onChange={(value) => updateIntegration("minio", "bucket", value)}
        />
        <IntegrationInput
          label="Regiao"
          value={settings.minio.region}
          placeholder="us-east-1"
          onChange={(value) => updateIntegration("minio", "region", value)}
        />
        <label className="flex h-10 items-center justify-between rounded-[14px] border border-border bg-input/65 px-4 text-sm font-bold">
          SSL ativo
          <input
            type="checkbox"
            checked={settings.minio.useSSL}
            onChange={(event) => updateIntegration("minio", "useSSL", event.target.checked)}
            className="size-4 accent-primary"
          />
        </label>
      </IntegrationCard>
    </section>
  );
}

function IntegrationCard({
  title,
  description,
  icon: Icon,
  status,
  onTest,
  children
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status: IntegrationStatus;
  onTest: () => void;
  children: React.ReactNode;
}) {
  const statusMap = {
    pending: { label: "Pendente", className: "ap-status-new", icon: AlertCircle },
    connected: { label: "Conectado", className: "ap-status-success", icon: CheckCircle2 },
    error: { label: "Incompleto", className: "ap-status-danger", icon: AlertCircle }
  };
  const StatusIcon = statusMap[status].icon;

  return (
    <section className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Icon size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold">{title}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-black", statusMap[status].className)}>
            <StatusIcon size={14} />
            {statusMap[status].label}
          </span>
          <button
            type="button"
            onClick={onTest}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-black text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <KeyRound size={14} />
            Testar
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function IntegrationInput({
  label,
  value,
  onChange,
  placeholder,
  secret = false,
  envConfigured = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
  envConfigured?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span>{label}</span>
        {envConfigured ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-black tracking-normal text-success">
            <CheckCircle2 size={11} />
            Env ativo
          </span>
        ) : null}
      </span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={envConfigured && !value ? "Configurada por variavel de ambiente" : placeholder}
        className="h-10 w-full rounded-[14px] border border-border bg-input/65 px-4 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

type PromptFieldKey = keyof Pick<
  AiBusinessSettings,
  "prices" | "customPrompt" | "triagePrompt" | "sdrPrompt" | "orchestratorPrompt" | "supervisorPrompt"
>;

type PromptEditorProps = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rowsClassName?: string;
  mono?: boolean;
  onExpand: () => void;
};

type AiControlSettings = {
  whatsappPaused: boolean;
  pausedReason: string;
  updatedAt?: string;
};

type AiTestMessage = {
  role: "lead" | "ai";
  content: string;
};

type NotificationTestRecipient = {
  label: string;
  phone: string;
  type: "internal" | "support";
};

function PromptEditor({
  label,
  description,
  value,
  onChange,
  placeholder,
  rowsClassName = "min-h-32",
  mono = false,
  onExpand
}: PromptEditorProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex h-8 items-center gap-2 rounded-[12px] border border-primary/25 bg-primary/10 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-primary transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15"
        >
          <Maximize2 size={13} />
          Expandir
        </button>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn("kanban-input resize-y leading-6", rowsClassName, mono ? "font-mono text-xs" : "")}
        placeholder={placeholder}
      />
      {description ? <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
    </label>
  );
}

function AiCommercialRuntimePanel({
  aiControl,
  controlLoading,
  controlMessage,
  onToggleWhatsappAiPause,
  aiTestMessages,
  aiTestLoading,
  aiTestInput,
  aiTestError,
  onAiTestInputChange,
  onSendAiTestMessage,
  notificationTesting,
  notificationRecipientsLoading,
  notificationPickerOpen,
  notificationRecipients,
  notificationTestMessage,
  onToggleNotificationPicker,
  onSendNotificationTest
}: {
  aiControl: AiControlSettings;
  controlLoading: boolean;
  controlMessage: string;
  onToggleWhatsappAiPause: () => void;
  aiTestMessages: AiTestMessage[];
  aiTestLoading: boolean;
  aiTestInput: string;
  aiTestError: string;
  onAiTestInputChange: (value: string) => void;
  onSendAiTestMessage: () => void;
  notificationTesting: boolean;
  notificationRecipientsLoading: boolean;
  notificationPickerOpen: boolean;
  notificationRecipients: NotificationTestRecipient[];
  notificationTestMessage: string;
  onToggleNotificationPicker: () => void;
  onSendNotificationTest: (phone: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.15fr_0.85fr]">
      <div className="rounded-[20px] border border-sky-400/20 bg-[linear-gradient(145deg,rgba(11,95,165,0.18),rgba(255,255,255,0.035))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Controle WhatsApp</p>
            <h3 className="mt-1 text-base font-extrabold">
              IA {aiControl.whatsappPaused ? "pausada" : "ativa"}
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Pausa geral para impedir novas respostas automaticas no WhatsApp.
            </p>
          </div>
          <span className={cn(
            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase",
            aiControl.whatsappPaused
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-sky-300/30 bg-sky-400/10 text-sky-100"
          )}>
            <span className={cn("size-2 rounded-full", aiControl.whatsappPaused ? "bg-primary" : "bg-sky-300")} />
            {aiControl.whatsappPaused ? "Pausada" : "Ativa"}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleWhatsappAiPause}
          disabled={controlLoading}
          className={cn(
            "mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-70",
            aiControl.whatsappPaused
              ? "ap-button-primary"
              : "border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
          )}
        >
          {controlLoading ? <Loader2 className="size-4 animate-spin" /> : aiControl.whatsappPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
          {aiControl.whatsappPaused ? "Retomar IA no WhatsApp" : "Pausar IA no WhatsApp"}
        </button>
        {controlMessage ? <p className="mt-3 text-xs font-semibold text-muted-foreground">{controlMessage}</p> : null}
      </div>

      <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Teste interno</p>
            <h3 className="mt-1 text-base font-extrabold">Chat de teste da IA</h3>
          </div>
          <MessageCircle className="size-5 text-primary" />
        </div>
        <div className="mt-4 h-48 space-y-3 overflow-y-auto rounded-[16px] border border-border bg-background/55 p-3">
          {aiTestMessages.length === 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Simule uma pergunta do lead para validar o prompt antes de testar no WhatsApp real.
            </p>
          ) : (
            aiTestMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "max-w-[88%] rounded-[16px] px-3 py-2 text-xs leading-5",
                  message.role === "ai"
                    ? "ml-auto border border-sky-300/20 bg-sky-400/10 text-sky-50"
                    : "border border-border bg-card text-foreground"
                )}
              >
                {message.content}
              </div>
            ))
          )}
          {aiTestLoading ? (
            <div className="ml-auto flex w-fit items-center gap-2 rounded-[16px] border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-50">
              <Loader2 className="size-3 animate-spin" />
              IA pensando
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={aiTestInput}
            onChange={(event) => onAiTestInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendAiTestMessage();
              }
            }}
            className="kanban-input h-10"
            placeholder="Digite uma mensagem de teste..."
          />
          <button
            type="button"
            onClick={onSendAiTestMessage}
            disabled={aiTestLoading || !aiTestInput.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar teste para IA"
          >
            <Send size={16} />
          </button>
        </div>
        {aiTestError ? <p className="mt-2 text-xs font-semibold text-danger">{aiTestError}</p> : null}
      </div>

      <div className="rounded-[20px] border border-primary/18 bg-[linear-gradient(145deg,rgba(250,197,21,0.10),rgba(255,255,255,0.035))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Notificacoes</p>
            <h3 className="mt-1 text-base font-extrabold">Teste WhatsApp interno</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Escolha um numero cadastrado para testar individualmente.
            </p>
          </div>
          <BellRing className="size-5 text-primary" />
        </div>
        <button
          type="button"
          onClick={onToggleNotificationPicker}
          disabled={notificationRecipientsLoading}
          className="ap-button-primary mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-extrabold disabled:cursor-wait disabled:opacity-70"
        >
          {notificationRecipientsLoading ? <Loader2 className="size-4 animate-spin" /> : <BellRing size={16} />}
          {notificationPickerOpen ? "Ocultar numeros de teste" : "Escolher numero para teste"}
        </button>
        {notificationPickerOpen ? (
          <div className="mt-3 grid gap-2">
            {notificationRecipients.length === 0 ? (
              <p className="rounded-[14px] border border-border bg-background/55 px-3 py-2 text-xs text-muted-foreground">
                Nenhum numero cadastrado para teste.
              </p>
            ) : notificationRecipients.map((recipient) => (
              <button
                key={`${recipient.type}-${recipient.phone}`}
                type="button"
                onClick={() => onSendNotificationTest(recipient.phone)}
                disabled={notificationTesting}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-background/55 px-3 py-2 text-left text-xs transition hover:border-primary/35 hover:bg-primary/10 disabled:cursor-wait disabled:opacity-70"
              >
                <span>
                  <span className="block font-extrabold text-foreground">{recipient.label}</span>
                  <span className="block font-mono text-muted-foreground">{recipient.phone}</span>
                </span>
                <span className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase",
                  recipient.type === "support"
                    ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                    : "border-primary/25 bg-primary/10 text-primary"
                )}>
                  {recipient.type === "support" ? "Erro" : "Interno"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {notificationTesting ? <p className="mt-3 text-xs font-semibold text-muted-foreground">Enviando teste...</p> : null}
        {notificationTestMessage ? (
          <p className="mt-3 text-xs font-semibold text-muted-foreground">{notificationTestMessage}</p>
        ) : null}
      </div>
    </div>
  );
}

function IaComercialPanel() {
  const [settings, setSettings] = useState<AiBusinessSettings>(defaultAiBusinessSettings);
  const [aiControl, setAiControl] = useState<AiControlSettings>({ whatsappPaused: false, pausedReason: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState<{ key: PromptFieldKey; title: string; mono?: boolean } | null>(null);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlMessage, setControlMessage] = useState("");
  const [aiTestInput, setAiTestInput] = useState("");
  const [aiTestMessages, setAiTestMessages] = useState<AiTestMessage[]>([]);
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestError, setAiTestError] = useState("");
  const [notificationTesting, setNotificationTesting] = useState(false);
  const [notificationTestMessage, setNotificationTestMessage] = useState("");
  const [notificationRecipients, setNotificationRecipients] = useState<NotificationTestRecipient[]>([]);
  const [notificationPickerOpen, setNotificationPickerOpen] = useState(false);
  const [notificationRecipientsLoading, setNotificationRecipientsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const stored = window.localStorage.getItem(aiBusinessSettingsKey);
      if (stored) {
        setSettings({ ...defaultAiBusinessSettings, ...(JSON.parse(stored) as Partial<AiBusinessSettings>) });
      }
    } catch {
      setSettings(defaultAiBusinessSettings);
    }

    fetch("/api/settings/ai-business")
      .then((response) => response.json())
      .then((data: { settings?: AiBusinessSettings }) => {
        if (active && data.settings) {
          setSettings(data.settings);
        }
      })
      .catch(() => {
        if (active) {
          setSettings(defaultAiBusinessSettings);
        }
      });

    fetch("/api/settings/ai-control")
      .then((response) => response.json())
      .then((data: { settings?: AiControlSettings }) => {
        if (active && data.settings) {
          setAiControl(data.settings);
        }
      })
      .catch(() => {
        if (active) {
          setControlMessage("Nao foi possivel carregar o status geral da IA.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function updateField(key: keyof AiBusinessSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  }

  function updateExpandedPrompt(value: string) {
    if (!expandedPrompt) return;
    updateField(expandedPrompt.key, value);
  }

  async function saveSettings() {
    setError("");
    setSaved(false);

    try {
      const response = await fetch("/api/settings/ai-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Falha ao salvar no banco.");
      }

      const data = (await response.json()) as { settings: AiBusinessSettings };
      setSettings(data.settings);
      window.localStorage.setItem(aiBusinessSettingsKey, JSON.stringify(data.settings));
      window.dispatchEvent(new Event("auto-pro-ia:preferences-updated"));
      setSaved(true);
    } catch (saveError) {
      setSaved(false);
      setError(saveError instanceof Error ? `Nao foi possivel salvar no banco: ${saveError.message}` : "Nao foi possivel salvar no banco.");
    }
  }

  async function toggleWhatsappAiPause() {
    setControlLoading(true);
    setControlMessage("");

    const nextPaused = !aiControl.whatsappPaused;

    try {
      const response = await fetch("/api/settings/ai-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappPaused: nextPaused,
          pausedReason: nextPaused ? "Pausada manualmente no painel IA Comercial." : ""
        })
      });

      const data = (await response.json().catch(() => null)) as { settings?: AiControlSettings; error?: string } | null;
      if (!response.ok || !data?.settings) {
        throw new Error(data?.error ?? "Nao foi possivel atualizar o status geral da IA.");
      }

      setAiControl(data.settings);
      setControlMessage(nextPaused ? "IA pausada para novas respostas no WhatsApp." : "IA retomada para respostas automaticas no WhatsApp.");
    } catch (toggleError) {
      setControlMessage(toggleError instanceof Error ? toggleError.message : "Nao foi possivel atualizar o status geral da IA.");
    } finally {
      setControlLoading(false);
    }
  }

  async function sendAiTestMessage() {
    const message = aiTestInput.trim();
    if (!message || aiTestLoading) return;

    const nextMessages: AiTestMessage[] = [...aiTestMessages, { role: "lead", content: message }];
    setAiTestMessages(nextMessages);
    setAiTestInput("");
    setAiTestLoading(true);
    setAiTestError("");

    try {
      const response = await fetch("/api/settings/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadName: "Lead de teste",
          message,
          history: aiTestMessages.map((item) => ({
            role: item.role,
            content: item.content
          }))
        })
      });

      const data = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error ?? "Nao foi possivel gerar resposta da IA.");
      }

      setAiTestMessages([...nextMessages, { role: "ai", content: data.reply }]);
    } catch (testError) {
      setAiTestError(testError instanceof Error ? testError.message : "Nao foi possivel testar a IA.");
      setAiTestMessages(nextMessages);
    } finally {
      setAiTestLoading(false);
    }
  }

  async function loadNotificationRecipients() {
    setNotificationRecipientsLoading(true);
    setNotificationTestMessage("");

    try {
      const response = await fetch("/api/settings/notification-test", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as {
        recipients?: NotificationTestRecipient[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Nao foi possivel carregar os numeros de teste.");
      }

      setNotificationRecipients(data?.recipients ?? []);
      setNotificationPickerOpen(true);
    } catch (recipientsError) {
      setNotificationTestMessage(recipientsError instanceof Error ? recipientsError.message : "Nao foi possivel carregar os numeros de teste.");
    } finally {
      setNotificationRecipientsLoading(false);
    }
  }

  async function toggleNotificationPicker() {
    if (notificationPickerOpen) {
      setNotificationPickerOpen(false);
      return;
    }

    if (notificationRecipients.length > 0) {
      setNotificationPickerOpen(true);
      return;
    }

    await loadNotificationRecipients();
  }

  async function sendNotificationTest(phone: string) {
    setNotificationTesting(true);
    setNotificationTestMessage("");

    try {
      const response = await fetch("/api/settings/notification-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = (await response.json().catch(() => null)) as {
        sent?: string[];
        failed?: Array<{ phone: string; error: string }>;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Nao foi possivel enviar notificacao de teste.");
      }

      const sentCount = data?.sent?.length ?? 0;
      const failedCount = data?.failed?.length ?? 0;
      const recipient = notificationRecipients.find((item) => item.phone === phone);
      setNotificationTestMessage(
        failedCount > 0
          ? `Teste enviado para ${sentCount} numero(s), com ${failedCount} falha(s).`
          : `Teste enviado para ${recipient?.label ?? phone}.`
      );
    } catch (notificationError) {
      setNotificationTestMessage(notificationError instanceof Error ? notificationError.message : "Nao foi possivel testar as notificacoes.");
    } finally {
      setNotificationTesting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Prompt dinamico</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-normal">IA Comercial</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Estes dados entram no prompt da IA em tempo real para orientar respostas sobre valores, endereco,
            horario e identidade do agente.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0B5FA5]/35 bg-[#0B5FA5]/14 px-3 py-1.5 text-xs font-black text-blue-100">
          <Bot size={14} />
          Usado no WhatsApp
        </span>
      </div>

      <form
        className="mt-6 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void saveSettings();
        }}
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Nome do agente IA
            </span>
            <input
              value={settings.agentName}
              onChange={(event) => updateField("agentName", event.target.value)}
              className="kanban-input"
              placeholder="Ana"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Horarios de atendimento
            </span>
            <input
              value={settings.hours}
              onChange={(event) => updateField("hours", event.target.value)}
              className="kanban-input"
              placeholder="Segunda a sexta, das 8h as 18h"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Endereco
          </span>
          <input
            value={settings.address}
            onChange={(event) => updateField("address", event.target.value)}
            className="kanban-input"
            placeholder="Rua, numero, bairro, cidade"
          />
        </label>

        <PromptEditor
          label="Precos e regras comerciais"
          value={settings.prices}
          onChange={(value) => updateField("prices", value)}
          rowsClassName="min-h-36"
          placeholder="Informe valores por categoria, condicoes e regras para a IA usar."
          onExpand={() => setExpandedPrompt({ key: "prices", title: "Precos e regras comerciais" })}
        />

        <PromptEditor
          label="Regras dinamicas complementares"
          value={settings.customPrompt}
          onChange={(value) => updateField("customPrompt", value)}
          rowsClassName="min-h-28"
          placeholder="Defina limites comerciais, regras de handoff, tom e prioridades que podem mudar no dia a dia."
          description="Este bloco entra no prompt em tempo real junto com valores, endereco e horarios."
          onExpand={() => setExpandedPrompt({ key: "customPrompt", title: "Regras dinamicas complementares" })}
        />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Previa do contexto enviado para a IA</p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Agente:</strong> {settings.agentName}</p>
            <p><strong className="text-foreground">Endereco:</strong> {settings.address}</p>
            <p><strong className="text-foreground">Horario:</strong> {settings.hours}</p>
            <p><strong className="text-foreground">Precos:</strong> {settings.prices}</p>
            <p><strong className="text-foreground">Prompt:</strong> {settings.customPrompt}</p>
          </div>
        </div>

      </form>
      </div>

      <div className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Arquitetura de prompts</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-normal">Agentes operacionais</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure separadamente triagem, SDR, orquestrador e supervisor. Todos os blocos sao salvos juntos nas regras da IA.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
            <Bot size={14} />
            4 agentes
          </span>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#0B5FA5]/20 bg-[linear-gradient(145deg,rgba(11,95,165,0.14),rgba(255,255,255,0.035))] p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Prompt agente de triagem</p>
            <h3 className="mt-1 text-lg font-extrabold tracking-normal">Entrada e classificacao inicial</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Decide se a conversa nova continua com IA ativa ou entra pausada para atendimento humano.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-black text-sky-100">
            <Bot size={14} />
            Triagem
          </span>
        </div>

        <div className="mt-5">
          <PromptEditor
            label="Prompt agente de triagem"
            value={settings.triagePrompt}
            onChange={(value) => updateField("triagePrompt", value)}
            rowsClassName="min-h-64"
            mono
            placeholder="Defina quando uma conversa nova deve seguir automatica ou ser pausada para humano."
            onExpand={() => setExpandedPrompt({ key: "triagePrompt", title: "Prompt agente de triagem", mono: true })}
          />
        </div>
      </div>

      <div className="rounded-[22px] border border-[#0B5FA5]/20 bg-[linear-gradient(145deg,rgba(11,95,165,0.12),rgba(255,255,255,0.035))] p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Prompt agente SDR</p>
            <h3 className="mt-1 text-lg font-extrabold tracking-normal">Direcionamento do atendimento comercial</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure a orientação específica para o agente SDR qualificar leads, identificar intenção e acionar humano no momento certo.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-black text-sky-100">
            <Bot size={14} />
            SDR IA
          </span>
        </div>

        <div className="mt-5">
          <PromptEditor
            label="Prompt agente SDR"
            value={settings.sdrPrompt}
            onChange={(value) => updateField("sdrPrompt", value)}
            rowsClassName="min-h-[420px]"
            mono
            placeholder="Cole aqui o prompt base do agente SDR."
            description={`Use os placeholders {{agentName}}, {{companyName}} e {{dynamicContext}} para manter o prompt dinamico.`}
            onExpand={() => setExpandedPrompt({ key: "sdrPrompt", title: "Direcionamento do atendimento comercial", mono: true })}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[22px] border border-[#FAC515]/18 bg-[linear-gradient(145deg,rgba(250,197,21,0.10),rgba(255,255,255,0.03))] p-6 shadow-panel">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Prompt agente orquestrador</p>
              <h3 className="mt-1 text-lg font-extrabold tracking-normal">Orquestracao do fluxo</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Define como a IA decide entre SDR, atendimento humano, follow-up e acompanhamento.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
              <Bot size={14} />
              Orquestrador
            </span>
          </div>
          <div className="mt-5">
            <PromptEditor
              label="Prompt agente orquestrador"
              value={settings.orchestratorPrompt}
              onChange={(value) => updateField("orchestratorPrompt", value)}
              rowsClassName="min-h-64"
              mono
              placeholder="Defina regras de roteamento, prioridade, handoff e etapas do fluxo."
              onExpand={() => setExpandedPrompt({ key: "orchestratorPrompt", title: "Prompt agente orquestrador", mono: true })}
            />
          </div>
        </div>

        <div className="rounded-[22px] border border-[#0B5FA5]/20 bg-[linear-gradient(145deg,rgba(11,95,165,0.12),rgba(255,255,255,0.03))] p-6 shadow-panel">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Prompt supervisor</p>
              <h3 className="mt-1 text-lg font-extrabold tracking-normal">Supervisao de qualidade</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Regras para revisar risco, consistencia comercial, seguranca e necessidade de intervencao humana.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-black text-sky-100">
              <ShieldCheck size={14} />
              Supervisor
            </span>
          </div>
          <div className="mt-5">
            <PromptEditor
              label="Prompt supervisor"
              value={settings.supervisorPrompt}
              onChange={(value) => updateField("supervisorPrompt", value)}
              rowsClassName="min-h-64"
              mono
              placeholder="Defina criterios de auditoria, aprovacao e bloqueios do agente."
              onExpand={() => setExpandedPrompt({ key: "supervisorPrompt", title: "Prompt supervisor", mono: true })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Operacao e testes</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-normal">Controle da IA e validacoes internas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Use esta area para pausar a IA no WhatsApp, testar o prompt e validar notificacoes sem sair do CRM.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-black text-sky-100">
            <Bot size={14} />
            Ambiente de teste
          </span>
        </div>
        <AiCommercialRuntimePanel
          aiControl={aiControl}
          controlLoading={controlLoading}
          controlMessage={controlMessage}
          onToggleWhatsappAiPause={() => void toggleWhatsappAiPause()}
          aiTestMessages={aiTestMessages}
          aiTestLoading={aiTestLoading}
          aiTestInput={aiTestInput}
          aiTestError={aiTestError}
          onAiTestInputChange={setAiTestInput}
          onSendAiTestMessage={() => void sendAiTestMessage()}
          notificationTesting={notificationTesting}
          notificationRecipientsLoading={notificationRecipientsLoading}
          notificationPickerOpen={notificationPickerOpen}
          notificationRecipients={notificationRecipients}
          notificationTestMessage={notificationTestMessage}
          onToggleNotificationPicker={() => void toggleNotificationPicker()}
          onSendNotificationTest={(phone) => void sendNotificationTest(phone)}
        />
      </div>

      {expandedPrompt ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05080d]/82 p-5 backdrop-blur-xl">
          <div className="flex h-[86vh] w-full max-w-6xl flex-col rounded-[24px] border border-border bg-card shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Editor expandido</p>
                <h3 className="mt-1 text-lg font-extrabold">{expandedPrompt.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setExpandedPrompt(null)}
                className="grid size-10 place-items-center rounded-[14px] border border-border bg-white/[0.04] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                aria-label="Fechar editor expandido"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={settings[expandedPrompt.key]}
              onChange={(event) => updateExpandedPrompt(event.target.value)}
              className={cn(
                "min-h-0 flex-1 resize-none border-0 bg-transparent p-5 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground/50",
                expandedPrompt.mono ? "font-mono text-xs" : ""
              )}
            />
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 text-xs text-muted-foreground">
              <span>As alteracoes feitas aqui tambem precisam ser salvas no botao Salvar regras da IA.</span>
              <button
                type="button"
                onClick={() => setExpandedPrompt(null)}
                className="ap-button-primary inline-flex h-9 items-center justify-center rounded-[12px] px-4 text-xs font-extrabold"
              >
                Concluir edicao
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-4 z-20 rounded-[18px] border border-border bg-card/90 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs leading-5 text-muted-foreground">
            Salva dados dinamicos, prompt SDR, agente orquestrador e supervisor no banco.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveSettings()}
              className="ap-button-primary inline-flex h-10 items-center justify-center rounded-[14px] px-5 text-sm font-extrabold"
            >
              Salvar todos os prompts
            </button>
            {saved ? <span className="text-sm font-semibold text-success">Prompts atualizados</span> : null}
            {error ? <span className="text-sm font-semibold text-danger">{error}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SegurancaPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("A confirmacao precisa ser igual a nova senha.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel alterar a senha.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Senha alterada com sucesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Acesso seguro</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-normal">Alteracao de senha</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Atualize sua senha de acesso ao painel. Use pelo menos 8 caracteres com letras e numeros.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
          <KeyRound size={14} />
          Conta protegida
        </span>
      </div>

      <form className="mt-6 grid max-w-2xl gap-5" onSubmit={submitPassword}>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Senha atual
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="kanban-input"
            required
          />
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Nova senha
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="kanban-input"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Confirmar nova senha
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="kanban-input"
              required
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={loading}
            className="ap-button-primary inline-flex h-10 items-center justify-center rounded-[14px] px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Alterando..." : "Alterar senha"}
          </button>
          {message ? <span className="text-sm font-semibold text-success">{message}</span> : null}
          {error ? <span className="text-sm font-semibold text-danger">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}

function PreferenciasPanel() {
  const [rules, setRules] = useState(defaultPreferences);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [aiSettings, setAiSettings] = useState<AiBusinessSettings>(defaultAiBusinessSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    setTheme(storedTheme);
    applyTheme(storedTheme);
    try {
      const storedPreferences = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (storedPreferences) {
        const parsed = JSON.parse(storedPreferences) as typeof defaultPreferences;
        if (Array.isArray(parsed)) {
          setRules(defaultPreferences.map((rule) => parsed.find((item) => item.key === rule.key) ?? rule));
        }
      }

      const storedAiSettings = window.localStorage.getItem(aiBusinessSettingsKey);
      if (storedAiSettings) {
        setAiSettings({ ...defaultAiBusinessSettings, ...(JSON.parse(storedAiSettings) as Partial<AiBusinessSettings>) });
      }
    } catch {
      setRules(defaultPreferences);
      setAiSettings(defaultAiBusinessSettings);
    }
  }, []);

  function applyTheme(nextTheme: "dark" | "light") {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme === "light" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  function changeTheme(nextTheme: "dark" | "light") {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setSaved(false);
  }

  function toggleRule(ruleKey: string) {
    setRules((current) =>
      current.map((rule) => (rule.key === ruleKey ? { ...rule, enabled: !rule.enabled } : rule))
    );
    setSaved(false);
  }

  function updateAiPreference(key: keyof AiBusinessSettings, value: string) {
    setAiSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function savePreferences() {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(rules));
    window.localStorage.setItem(aiBusinessSettingsKey, JSON.stringify(aiSettings));
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";

    const storedUsers = window.localStorage.getItem(USERS_STORAGE_KEY);
    const parsedUsers = storedUsers ? (JSON.parse(storedUsers) as UserRecord[]) : defaultUsers;
    const syncedUsers = parsedUsers.map((user) =>
      user.role === "bot" ? { ...user, name: aiSettings.agentName, initials: "IA" } : user
    );
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(syncedUsers));
    window.dispatchEvent(new Event("auto-pro-ia:preferences-updated"));
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] border border-border bg-card/72 shadow-panel">
        <div className="flex flex-col gap-5 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Experiencia</p>
            <h2 className="mt-2 text-lg font-extrabold tracking-normal">Preferencias do sistema</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Ajuste visual, operacao e regras leves para reduzir ruido no atendimento diario.
            </p>
          </div>
          <button
            type="button"
            onClick={savePreferences}
            className="inline-flex h-11 items-center justify-center rounded-[14px] bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-glow"
          >
            Salvar preferencias
          </button>
          <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/10 bg-white/[0.035] p-1.5">
            {[
              { id: "dark" as const, label: "Escuro", icon: Moon },
              { id: "light" as const, label: "Claro", icon: Sun }
            ].map((option) => {
              const Icon = option.icon;
              const active = theme === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => changeTheme(option.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-extrabold transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 border-b border-border p-4 md:grid-cols-2">
          <label className="block rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Nome da IA</span>
            <input
              value={aiSettings.agentName}
              onChange={(event) => updateAiPreference("agentName", event.target.value)}
              className="kanban-input"
              placeholder="Ana"
            />
            <span className="mt-2 block text-xs leading-5 text-muted-foreground">Esse nome aparece no usuario IA e alimenta o prompt automatico.</span>
          </label>
          <label className="block rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Horario padrao</span>
            <input
              value={aiSettings.hours}
              onChange={(event) => updateAiPreference("hours", event.target.value)}
              className="kanban-input"
              placeholder="Segunda a sexta, das 8h as 18h"
            />
            <span className="mt-2 block text-xs leading-5 text-muted-foreground">Aplicado imediatamente nas orientacoes da IA.</span>
          </label>
          {saved ? <p className="md:col-span-2 text-sm font-semibold text-success">Preferencias salvas e aplicadas.</p> : null}
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2">
          {rules.map((preference) => (
            <div
              key={preference.title}
              className="flex min-h-24 items-center justify-between gap-5 rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-primary/25 hover:bg-white/[0.055]"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-5">{preference.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{preference.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleRule(preference.key)}
                aria-pressed={preference.enabled}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full border transition",
                  preference.enabled ? "border-primary/40 bg-primary" : "border-white/10 bg-input"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 size-5 rounded-full bg-background shadow-sm transition",
                    preference.enabled ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-[22px] border border-border bg-card/72 p-6 shadow-panel">
      <h2 className="text-lg font-extrabold tracking-normal">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
    </section>
  );
}
