export type Role = "super_admin" | "admin" | "gerente" | "atendente" | "operador" | "visualizador" | "ia";

const roleLevel: Record<Role, number> = {
  super_admin: 0,
  admin: 1,
  gerente: 2,
  atendente: 3,
  operador: 3,
  visualizador: 4,
  ia: 5
};

export function can(currentRole: Role, minimumRole: Role) {
  return roleLevel[currentRole] <= roleLevel[minimumRole];
}

export function assertCan(currentRole: Role, minimumRole: Role) {
  if (!can(currentRole, minimumRole)) {
    throw new Error("Sem permissao para executar esta acao.");
  }
}
