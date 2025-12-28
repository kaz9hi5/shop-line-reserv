"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentRole } from "@/lib/admin-db-proxy";

const items = [
  { href: "/admin", label: "本日の予約一覧と予約受付" },
  { href: "/admin/settings", label: "営業時間と日別営業時間の設定" },
  { href: "/admin/treatments", label: "施術メニュー編集" },
  { href: "/admin/members", label: "メンバー編集", managerOnly: true },
  { href: "/admin/ip-management", label: "アクセス許可", managerOnly: true }
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<"manager" | "staff" | "unauthorized" | "loading">("loading");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await getCurrentRole();
        if (mounted) setRole(r);
      } catch {
        if (mounted) setRole("unauthorized");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <nav className="flex flex-wrap gap-2">
      {items
        .filter((it) => {
          if (!(it as any).managerOnly) return true;
          return role === "manager";
        })
        .map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-5 shadow-sm",
              "max-w-full whitespace-normal",
              active
                ? "border-slate-300 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}


