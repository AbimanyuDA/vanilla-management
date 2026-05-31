"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Users, ShieldCheck, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Market Intelligence",
    href: "/dashboard/market",
    icon: TrendingUp,
    roles: ["EKSEKUTIF", "SALES_MANAGER", "DIREKTUR_KEUANGAN"],
  },
  {
    label: "Buyer Directory",
    href: "/dashboard/buyers",
    icon: Users,
    roles: ["EKSEKUTIF", "SALES_MANAGER"],
  },
  {
    label: "Compliance & Cost",
    href: "/dashboard/compliance",
    icon: ShieldCheck,
    roles: ["EKSEKUTIF", "DIREKTUR_KEUANGAN"],
  },
];

const ROLE_LABEL: Record<Role, string> = {
  EKSEKUTIF: "Eksekutif",
  SALES_MANAGER: "Sales Manager",
  DIREKTUR_KEUANGAN: "Direktur Keuangan",
};

type Props = {
  role: Role;
  userName: string | null;
};

export function Sidebar({ role, userName }: Props) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#ECA134" }}
          >
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate leading-tight">
              Vanilla Export
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight">
              Intelligence Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Navigasi Utama">
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Modul
        </p>
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group focus-ring",
                isActive
                  ? "text-foreground bg-orange-50"
                  : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              )}
              style={
                isActive
                  ? {
                      borderLeft: "3px solid #ECA134",
                      color: "#ECA134",
                      backgroundColor: "#FFF8EE",
                    }
                  : {}
              }
            >
              <Icon
                size={16}
                className={cn(
                  "flex-shrink-0 transition-colors",
                  isActive ? "" : "group-hover:text-foreground"
                )}
                style={isActive ? { color: "#ECA134" } : {}}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + Sign Out */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-foreground truncate">
            {userName ?? "Pengguna"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {ROLE_LABEL[role]}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors focus-ring"
        >
          <LogOut size={15} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
