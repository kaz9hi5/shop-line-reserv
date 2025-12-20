"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import {
  getAccessLogs,
  getAllowedIps,
  addAllowedIp as addAllowedIpDb,
  removeAllowedIp as removeAllowedIpDb,
  isAccessLogEnabled,
  setAccessLogEnabled as setAccessLogEnabledDb
} from "@/lib/access-logs";
import type { Database } from "@/lib/database.types";

type AccessLog = Database["public"]["Tables"]["admin_access_logs"]["Row"];
type AdminAllowedIp = Database["public"]["Tables"]["admin_allowed_ips"]["Row"];

const SHOP_NAME = "〇〇ネイルサロン";

export default function AdminAccessLogsPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<"all" | "allowed" | "denied">("all");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [allowedIps, setAllowedIps] = useState<AdminAllowedIp[]>([]);
  const [accessLogEnabled, setAccessLogEnabledState] = useState<boolean>(true);
  const [newIp, setNewIp] = useState<string>("");
  const [flash, setFlash] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [logsData, ipsData, enabled] = await Promise.all([
          getAccessLogs({ limit: 100 }),
          getAllowedIps(),
          isAccessLogEnabled()
        ]);
        setLogs(logsData);
        setAllowedIps(ipsData);
        setAccessLogEnabledState(enabled);
      } catch (err) {
        setFlash(`エラー: ${err instanceof Error ? err.message : "データの読み込みに失敗しました"}`);
        console.error("Failed to load access logs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.result === filter);
  }, [logs, filter]);

  const handleAddIp = async () => {
    const ip = newIp.trim();
    if (!ip) return;
    try {
      await addAllowedIpDb(ip);
      const ips = await getAllowedIps();
      setAllowedIps(ips);
      setNewIp("");
      setFlash("IPアドレスを追加しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "IPアドレスの追加に失敗しました"}`);
    }
  };

  const handleRemoveIp = async (ip: string) => {
    try {
      await removeAllowedIpDb(ip);
      const ips = await getAllowedIps();
      setAllowedIps(ips);
      setFlash("IPアドレスを削除しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "IPアドレスの削除に失敗しました"}`);
    }
  };

  const handleSetAccessLogEnabled = async (enabled: boolean) => {
    try {
      await setAccessLogEnabledDb(enabled);
      setAccessLogEnabledState(enabled);
      setFlash(`アクセスログ記録を${enabled ? "ON" : "OFF"}にしました`);
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "設定の更新に失敗しました"}`);
    }
  };

  return (
    <div className="space-y-4">
      {flash ? (
        <div className="sticky top-3 z-40">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10">
              <div className="min-w-0 truncate">{flash}</div>
              <button
                type="button"
                onClick={() => setFlash(null)}
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

      <Card
        title="アクセスログ"
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">絞り込み</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            >
              <option value="all">すべて</option>
              <option value="allowed">許可</option>
              <option value="denied">拒否</option>
            </select>
          </div>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          管理画面へのアクセス履歴を確認し、許可 IP の選定に利用します。
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
            <div className="text-sm font-semibold text-slate-800">アクセスログ設定</div>
            <p className="mt-1 text-sm text-slate-600">アクセスログ記録を ON/OFF します。</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
              <div>
                <div className="text-sm font-semibold text-slate-800">アクセスログ記録</div>
                <div className="text-xs text-slate-500">デフォルトは ON</div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={accessLogEnabled}
                  onChange={(e) => handleSetAccessLogEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-slate-900"
                />
                {accessLogEnabled ? "ON" : "OFF"}
              </label>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
            <div className="text-sm font-semibold text-slate-800">許可 IP アドレス管理</div>
            <p className="mt-1 text-sm text-slate-600">
              管理画面へのアクセスを許可する IP を管理します（追加＝許可、削除＝拒否）。
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="例: 203.0.113.10"
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                />
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={handleAddIp}
                >
                  追加
                </button>
              </div>

              <ul className="divide-y divide-slate-200/70 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                {allowedIps.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-slate-500">
                    許可IPが登録されていません
                  </li>
                ) : (
                  allowedIps.map((ipData) => (
                    <li key={ipData.ip} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div className="text-sm font-medium text-slate-800">{ipData.ip}</div>
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

        {loading ? (
          <div className="mt-4 py-8 text-center text-sm text-slate-500">読み込み中...</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
            <div className="grid grid-cols-[160px_1fr_120px_1fr] bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
              <div>日時</div>
              <div>IP</div>
              <div>結果</div>
              <div>ページ</div>
            </div>
            <ul className="divide-y divide-slate-200/70 bg-white">
              {visible.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-slate-500">
                  アクセスログがありません
                </li>
              ) : (
                visible.map((l) => {
                  const date = new Date(l.created_at);
                  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
                  return (
                    <li
                      key={l.id}
                      className="grid grid-cols-[160px_1fr_120px_1fr] items-center gap-3 px-3 py-3"
                    >
                      <div className="text-sm text-slate-700">{dateStr}</div>
                      <div className="text-sm font-medium text-slate-800">{l.ip}</div>
                      <div>
                        {l.result === "allowed" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/70">
                            許可
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200/70">
                            拒否
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm text-slate-600">{l.path}</div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}


