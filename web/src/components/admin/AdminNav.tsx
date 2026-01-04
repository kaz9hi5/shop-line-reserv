"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentStaffInfo } from "@/lib/staff";

const items: Array<{
  href: string;
  label: string;
  managerOnly?: boolean;
}> = [
  { href: "/admin", label: "本日の予約一覧と予約受付" },
  { href: "/admin/settings", label: "営業時間と日別営業時間の設定" },
  { href: "/admin/treatments", label: "施術メニュー編集", managerOnly: true },
  { href: "/admin/members", label: "メンバー編集", managerOnly: true },
  { href: "/admin/ip-management", label: "アクセス許可", managerOnly: true }
];

export function AdminNav() {
  const pathname = usePathname();
  const [staffInfo, setStaffInfo] = useState<{ role: "manager" | "staff" } | null | "loading">("loading");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await getCurrentStaffInfo();
        if (mounted) {
          if (info && info.role) {
            setStaffInfo({ role: info.role });
          } else {
            setStaffInfo(null);
          }
        }
      } catch (error) {
        console.error("Failed to get staff info:", error);
        if (mounted) setStaffInfo(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter items based on role: manager-only items are shown only to managers
  const visibleItems = staffInfo === "loading" 
    ? items // Show all items while loading
    : staffInfo?.role === "manager"
    ? items // Manager sees all items
    : items.filter(item => !item.managerOnly); // Staff sees only non-manager-only items

  return (
    <nav className="flex flex-wrap gap-2">
      {visibleItems.map((it) => {
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
