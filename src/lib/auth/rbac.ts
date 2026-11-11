import type { Role } from "@/db/schema";

/**
 * Permissões por papel. SUPER_ADMIN = 4 sócios; MEMBER = equipe/freelancer;
 * CLIENT = dono do estabelecimento (vê e aprova só o que é dele).
 * Toda leitura de CLIENT ainda passa por canAccessClient() no servidor.
 */
export const PERMISSIONS = {
  "dashboard:global": ["SUPER_ADMIN", "MEMBER"],
  "finance:view": ["SUPER_ADMIN"], // MRR, valores de contrato, BI financeiro
  "clients:read": ["SUPER_ADMIN", "MEMBER"],
  "clients:write": ["SUPER_ADMIN", "MEMBER"],
  "clients:status": ["SUPER_ADMIN"],
  "contracts:write": ["SUPER_ADMIN"],
  "plates:read": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "plates:write": ["SUPER_ADMIN", "MEMBER"],
  "users:manage": ["SUPER_ADMIN"],
  // Módulo 2
  "reviews:read": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "reviews:reply": ["SUPER_ADMIN", "MEMBER"],
  "ai:use": ["SUPER_ADMIN", "MEMBER"],
  // Módulo 3
  "content:read": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "content:write": ["SUPER_ADMIN", "MEMBER"],
  "content:approve": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "integrations:manage": ["SUPER_ADMIN", "MEMBER"],
  // Módulo 4
  "monitors:read": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "monitors:write": ["SUPER_ADMIN", "MEMBER"],
  "alerts:manage": ["SUPER_ADMIN"],
  // Módulo 5
  "reports:read": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "bi:view": ["SUPER_ADMIN"],
  "system:view": ["SUPER_ADMIN"],
  // Estoque/comercial das plaquinhas, páginas e cortes
  "inventory:manage": ["SUPER_ADMIN", "MEMBER"],
  "pages:read": ["SUPER_ADMIN", "MEMBER", "CLIENT"],
  "pages:write": ["SUPER_ADMIN", "MEMBER"],
  // Vendas: prospecção, sites gerados, funil e abordagem
  "prospects:read": ["SUPER_ADMIN", "MEMBER"],
  "prospects:write": ["SUPER_ADMIN", "MEMBER"],
  "sites:write": ["SUPER_ADMIN", "MEMBER"],
  "vendas:config": ["SUPER_ADMIN"],
  "clips:use": ["SUPER_ADMIN", "MEMBER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Sócio",
  MEMBER: "Equipe",
  CLIENT: "Cliente",
};
