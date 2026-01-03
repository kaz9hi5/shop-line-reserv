"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { useAdminAccess } from "@/components/admin/AdminAccessContext";
import {
  getAllowedIps,
  removeAllowedIp as removeAllowedIpDb,
  isIpAllowed
} from "@/lib/access-logs";
import { getActiveStaff } from "@/lib/staff";
import { updateTable } from "@/lib/admin-db-proxy";
import type { Database } from "@/lib/database.types";

type AdminAllowedIp = Database["public"]["Tables"]["admin_allowed_ips"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];

const SHOP_NAME = "〇〇ネイルサロン";

export default function AdminIpManagementPage() {
  const { currentIp, isLoading: contextLoading } = useAdminAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowedIps, setAllowedIps] = useState<AdminAllowedIp[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  // Load allowed IPs
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const ipsData = await getAllowedIps();
        
        // 店長のIPアドレスを自動的に店長のstaff_idに紐付ける
        const staffRows = await getActiveStaff();
        const managerStaff = staffRows.find((s) => s.role === "manager");
        
        if (managerStaff) {
          const updatedIps = await Promise.all(
            ipsData.map(async (ipData) => {
              // role='manager'でstaff_idがnullの場合は自動的に店長のstaff_idを設定
              if (ipData.role === "manager" && !ipData.staff_id) {
                try {
                  await updateTable<AdminAllowedIp>(
                    "admin_allowed_ips",
                    {
                      staff_id: managerStaff.id,
                      role: "manager"
                    },
                    { ip: ipData.ip }
                  );
                  return { ...ipData, staff_id: managerStaff.id };
                } catch (err) {
                  console.error(`Failed to auto-link manager IP ${ipData.ip}:`, err);
                  return ipData;
                }
              }
              return ipData;
            })
          );
          setAllowedIps(updatedIps);
        } else {
          setAllowedIps(ipsData);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        if (errorMsg.includes("Unauthorized")) {
          // ホワイトリストがnullになった場合、ページをリロードしてAdminAccessGateに戻る
          window.location.reload();
          return;
        }
        setFlash(`エラー: ${errorMsg}`);
        console.error("Failed to load allowed IPs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Load staff list for linkage editing
  useEffect(() => {
    (async () => {
      try {
        const rows = await getActiveStaff();
        setStaffList(rows);
      } catch (err) {
        // Staff list is manager-only; if it fails, keep UI usable for delete.
        console.error("Failed to load staff list:", err);
      }
    })();
  }, []);

  // Auto-dismiss flash after 5000ms
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const dismissFlash = () => {
    setFlash(null);
  };

  const handleRemoveIp = async (ip: string) => {
    try {
      setSaving(true);
      // DBから削除
      await removeAllowedIpDb(ip);
      
      // 削除後に現在のIPがホワイトリストに存在するかチェック
      if (currentIp) {
        const stillAllowed = await isIpAllowed(currentIp);
        if (!stillAllowed) {
          // 現在のIPがホワイトリストに存在しない場合、403画面に遷移
          window.location.reload();
          return;
        }
      }
      
      // ローカル状態も更新
      try {
        const ips = await getAllowedIps();
        setAllowedIps(ips);
        setFlash("IPアドレスを削除しました");
      } catch (getErr) {
        // getAllowedIps() が失敗した場合（ホワイトリストがnullになった場合）、403画面に遷移
        const errorMsg = getErr instanceof Error ? getErr.message : "Unknown error";
        if (errorMsg.includes("Unauthorized")) {
          // ホワイトリストがnullになった場合、ページをリロードしてAdminAccessGateに戻る
          window.location.reload();
          return;
        }
        throw getErr;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      // Unauthorizedエラーの場合は403画面に遷移
      if (errorMsg.includes("Unauthorized") || (err as any)?.isUnauthorized) {
        window.location.reload();
        return;
      }
      setFlash(`エラー: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateIpStaffLink = async (ip: string, staffIdOrEmpty: string) => {
    const staffId = staffIdOrEmpty ? staffIdOrEmpty : null;
    const staff = staffId ? staffList.find((s) => s.id === staffId) : null;
    const nextRole: "manager" | "staff" | null = staff ? staff.role : null;
    try {
      setSaving(true);
      await updateTable<AdminAllowedIp>(
        "admin_allowed_ips",
        {
          staff_id: staffId,
          // Keep role in sync with staff.role when linked
          ...(nextRole ? { role: nextRole } : {})
        },
        { ip }
      );
      const ips = await getAllowedIps();
      setAllowedIps(ips);
      setFlash("紐づけを更新しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "紐づけの更新に失敗しました"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <BusyOverlay active={saving} label="保存中..." />
      {flash ? (
        <div className="sticky top-3 z-40">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10">
              <div className="min-w-0 truncate">{flash}</div>
              <button
                type="button"
                onClick={dismissFlash}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminHeader shopName={SHOP_NAME} />

      <Card>
        <AdminNav />
      </Card>

      <Card title="IPアドレス管理">
        <p className="text-sm leading-6 text-slate-600">
          管理画面へのアクセスを許可する IP アドレスを管理します。現在のIPアドレスを確認して、必要に応じて許可リストに追加してください。
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
            <div className="text-sm font-semibold text-slate-800">現在のIPアドレス</div>
            <p className="mt-1 text-sm text-slate-600">自動検出されたIPアドレスを表示します。</p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
              {contextLoading ? (
                <div className="text-sm text-slate-500">取得中...</div>
              ) : currentIp ? (
                <div>
                  <div className="text-sm font-semibold text-slate-800">{currentIp}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {allowedIps.some((ip) => ip.ip === currentIp) ? (
                      <span className="text-emerald-600">✓ 許可リストに登録済み</span>
                    ) : (
                      <span className="text-rose-600">✗ 許可リストに未登録</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">IPアドレスが検出されませんでした</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
            <div className="text-sm font-semibold text-slate-800">許可 IP アドレス管理</div>
            <p className="mt-1 text-sm text-slate-600">
              管理画面へのアクセスを許可する IP を管理します（削除＝拒否）。店長だけ自動に紐付けます。
            </p>
            <div className="mt-3 space-y-2">
              <ul className="divide-y divide-slate-200/70 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                {loading ? (
                  <li className="px-3 py-8 text-center text-sm text-slate-500">読み込み中...</li>
                ) : allowedIps.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-slate-500">
                    許可IPが登録されていません
                  </li>
                ) : (
                  allowedIps.map((ipData) => (
                    <li key={ipData.ip} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">{ipData.ip}</div>
                        {ipData.role && (
                          <div className="text-xs text-slate-500">
                            {ipData.role === "manager" ? "店長" : "店員"}
                          </div>
                        )}
                        <div className="mt-2">
                          <div className="text-xs font-semibold text-slate-600">IPアドレスと名前を紐付け</div>
                          <div className="mt-1">
                            {ipData.role === "manager" ? (
                              // 店長の場合は自動紐付けで編集不可
                              <div className="h-10 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                                {ipData.staff_id ? (
                                  staffList.find((s) => s.id === ipData.staff_id) ? (
                                    `店長: ${staffList.find((s) => s.id === ipData.staff_id)?.name}`
                                  ) : (
                                    "店長: 自動紐付け済み"
                                  )
                                ) : (
                                  "店長: 自動紐付け中..."
                                )}
                              </div>
                            ) : (
                              <select
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                value={ipData.staff_id ?? ""}
                                onChange={(e) => handleUpdateIpStaffLink(ipData.ip, e.target.value)}
                                disabled={saving || staffList.length === 0}
                              >
                                <option value="">未設定</option>
                                {staffList.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.role === "manager" ? "店長" : "店員"}: {s.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {ipData.role !== "manager" && staffList.length === 0 ? (
                            <div className="mt-1 text-xs text-slate-500">スタッフ一覧を取得できませんでした</div>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => handleRemoveIp(ipData.ip)}
                      >
                        削除
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

