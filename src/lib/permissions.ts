import type { Role } from "@/generated/prisma/enums";

export type Module = "market" | "buyers" | "compliance";
export type Action = "read" | "write" | "send";

const ACCESS_MATRIX: Record<Role, Record<Module, Action[]>> = {
  EKSEKUTIF: {
    market: ["read"],
    buyers: ["read"],
    compliance: ["read"],
  },
  SALES_MANAGER: {
    market: ["read"],
    buyers: ["read", "write", "send"],
    compliance: [],
  },
  DIREKTUR_KEUANGAN: {
    market: ["read"],
    buyers: [],
    compliance: ["read", "write"],
  },
};

export function canAccess(role: Role, module: Module, action: Action): boolean {
  return ACCESS_MATRIX[role]?.[module]?.includes(action) ?? false;
}

export function getAllowedModules(role: Role): Module[] {
  return (Object.keys(ACCESS_MATRIX[role]) as Module[]).filter(
    (mod) => ACCESS_MATRIX[role][mod].length > 0
  );
}
