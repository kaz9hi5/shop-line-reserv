"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentRole } from "@/lib/admin-db-proxy";
import { getCurrentStaffInfo } from "@/lib/staff";

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
  const [isStaffNameBlank, setIsStaffNameBlank] = useState(false);
  const [checkingStaffName, setCheckingStaffName] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await getCurrentRole();
        if (mounted) setRole(r);
        
        // Check if admin_allowed_ips record has staff_id linked and staff name is blank
        // Only check if we're on the IP management page
        // If staff_id is not linked (staffInfo is null), allow navigation
        // If staff_id is linked but staff.name is blank, block navigation to other pages
        if (pathname === "/admin/ip-management") {
          try {
            const staffInfo = await getCurrentStaffInfo();
            if (staffInfo) {
              // admin_allowed_ips.staff_id is linked and staff record exists
              // Check if name is blank (null, undefined, or empty string)
              const nameIsBlank = !staffInfo.name || staffInfo.name.trim() === "";
              if (mounted) setIsStaffNameBlank(nameIsBlank);
            } else {
              // If staff_id is not linked in admin_allowed_ips, allow navigation
              // (staff_id is null, so no staff name check needed)
              if (mounted) setIsStaffNameBlank(false);
            }
          } catch (error) {
            console.error("Failed to check staff name:", error);
            // On error, allow navigation (fallback)
            if (mounted) setIsStaffNameBlank(false);
          }
        } else {
          // Not on IP management page, reset the flag
          if (mounted) setIsStaffNameBlank(false);
        }
      } catch {
        if (mounted) setRole("unauthorized");
      } finally {
        if (mounted) setCheckingStaffName(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  // If staff name is blank and we're on IP management page, disable other links
  const shouldDisableLinks = isStaffNameBlank && pathname === "/admin/ip-management";

  return (
    <nav className="flex flex-wrap gap-2">
      {items
        .filter((it) => {
          if (!(it as any).managerOnly) return true;
          return role === "manager";
        })
        .map((it) => {
        const active = pathname === it.href;
        // Disable links to other pages if staff name is blank and we're on IP management page
        const isDisabled = shouldDisableLinks && it.href !== "/admin/ip-management";
        
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={(e) => {
              if (isDisabled) {
                e.preventDefault();
                alert("スタッフ名が設定されていないため、他の画面に遷移できません。店長がメンバー編集画面でスタッフ名を設定してください。");
              }
            }}
            className={[
              "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-5 shadow-sm",
              "max-w-full whitespace-normal",
              active
                ? "border-slate-300 bg-slate-900 text-white"
                : isDisabled
                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            ].join(" ")}
            aria-disabled={isDisabled}
          >
            {it.label}
          </Link>
        );
      })}
      {shouldDisableLinks && (
        <div className="w-full mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200/70">
          ⚠️ スタッフ名が設定されていないため、他の画面に遷移できません。店長がメンバー編集画面でスタッフ名を設定してください。
        </div>
      )}
    </nav>
  );
}


