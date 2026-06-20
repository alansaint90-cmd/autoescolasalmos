import type { Role } from "@/lib/auth/rbac";

export type PermissionRole = "admin" | "gerente" | "closer" | "sdr" | "financeiro" | "bot";

export type PermissionKey =
  | "viewLeads"
  | "createLeads"
  | "editLeads"
  | "deleteLeads"
  | "assignLeads"
  | "moveKanban"
  | "viewConversations"
  | "replyConversations"
  | "assumeAi"
  | "returnToAi"
  | "viewOwnReports"
  | "viewTeamReports"
  | "exportPdf"
  | "manageAi"
  | "manageUsers"
  | "manageIntegrations"
  | "viewFinance";

export type PermissionRecord = {
  key: PermissionKey;
  module: string;
  label: string;
  description: string;
} & Record<PermissionRole, boolean>;

export const rolePermissionsSettingsKey = "role-permissions";

export const defaultRolePermissions: PermissionRecord[] = [
  { key: "viewLeads", module: "Leads", label: "Ver leads", description: "Acessar lista, Kanban e perfil do lead.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: true },
  { key: "createLeads", module: "Leads", label: "Criar leads", description: "Cadastrar lead manualmente.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: true },
  { key: "editLeads", module: "Leads", label: "Editar leads", description: "Alterar dados, temperatura e observacoes.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: true },
  { key: "deleteLeads", module: "Leads", label: "Excluir leads", description: "Remover leads da base.", admin: true, gerente: true, closer: false, sdr: false, financeiro: false, bot: false },
  { key: "assignLeads", module: "Leads", label: "Atribuir responsavel", description: "Distribuir leads para vendedores.", admin: true, gerente: true, closer: false, sdr: false, financeiro: false, bot: true },
  { key: "moveKanban", module: "Kanban", label: "Mover Kanban", description: "Mover cards entre etapas do funil.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: true },
  { key: "viewConversations", module: "Conversas", label: "Ver conversas", description: "Visualizar historico do WhatsApp.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: true },
  { key: "replyConversations", module: "Conversas", label: "Responder conversas", description: "Enviar mensagens manuais.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: false },
  { key: "assumeAi", module: "Conversas", label: "Assumir da IA", description: "Pausar IA e assumir atendimento humano.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: false },
  { key: "returnToAi", module: "Conversas", label: "Devolver para IA", description: "Reativar fluxo automatico.", admin: true, gerente: true, closer: true, sdr: true, financeiro: false, bot: false },
  { key: "viewOwnReports", module: "Relatorios", label: "Ver relatorio proprio", description: "Acompanhar propria performance.", admin: true, gerente: true, closer: true, sdr: true, financeiro: true, bot: false },
  { key: "viewTeamReports", module: "Relatorios", label: "Ver relatorio da equipe", description: "Acessar ranking e funil geral.", admin: true, gerente: true, closer: false, sdr: false, financeiro: true, bot: false },
  { key: "exportPdf", module: "Relatorios", label: "Exportar PDF", description: "Gerar PDF dos relatorios.", admin: true, gerente: true, closer: false, sdr: false, financeiro: true, bot: false },
  { key: "viewFinance", module: "Financeiro", label: "Ver receita e vendas", description: "Visualizar valores, ticket e receita.", admin: true, gerente: true, closer: false, sdr: false, financeiro: true, bot: false },
  { key: "manageAi", module: "IA", label: "Gerenciar IA", description: "Editar regras, prompts e automacoes.", admin: true, gerente: true, closer: false, sdr: false, financeiro: false, bot: false },
  { key: "manageUsers", module: "Administracao", label: "Gerenciar usuarios", description: "Criar, editar e inativar usuarios.", admin: true, gerente: false, closer: false, sdr: false, financeiro: false, bot: false },
  { key: "manageIntegrations", module: "Administracao", label: "Alterar integracoes", description: "Configurar APIs e credenciais.", admin: true, gerente: false, closer: false, sdr: false, financeiro: false, bot: false }
];

export function permissionRoleFromAuthRole(role: Role): PermissionRole {
  if (role === "super_admin" || role === "admin") return "admin";
  if (role === "gerente") return "gerente";
  if (role === "atendente" || role === "operador") return "sdr";
  if (role === "visualizador") return "financeiro";
  return "bot";
}

export function normalizePermissions(value: unknown): PermissionRecord[] {
  const saved = Array.isArray(value) ? value as Array<Partial<PermissionRecord>> : [];

  return defaultRolePermissions.map((defaultPermission) => {
    const match = saved.find((item) => item.key === defaultPermission.key);
    return {
      ...defaultPermission,
      admin: match?.admin ?? defaultPermission.admin,
      gerente: match?.gerente ?? defaultPermission.gerente,
      closer: match?.closer ?? defaultPermission.closer,
      sdr: match?.sdr ?? defaultPermission.sdr,
      financeiro: match?.financeiro ?? defaultPermission.financeiro,
      bot: match?.bot ?? defaultPermission.bot
    };
  });
}
