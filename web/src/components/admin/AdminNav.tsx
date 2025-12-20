"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "本日の予約一覧と予約受付" },
  { href: "/admin/settings", label: "営業時間と日別営業時間の設定" },
  { href: "/admin/treatments", label: "施術メニュー編集" },
  { href: "/admin/access-logs", label: "アクセス許可とログ" }
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((it) => {
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


