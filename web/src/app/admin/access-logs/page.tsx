"use client";

import { useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { useAdminAccess } from "@/components/admin/AdminAccessContext";

const SHOP_NAME = "〇〇ネイルサロン";

export default function AdminAccessLogsPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<"all" | "allowed" | "denied">("all");
  const {
    currentIp,
    setCurrentIp,
    accessLogEnabled,
    setAccessLogEnabled,
    allowedIps,
    addAllowedIp,
    removeAllowedIp,
    logs,
    clearLogs
  } = useAdminAccess();
  const [newIp, setNewIp] = useState<string>("");
  const [draftIp, setDraftIp] = useState<string>(currentIp);

  const visible = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.result === filter);
  }, [logs, filter]);

  return (
    <div className="space-y-4">
      <AdminHeader
        shopName={SHOP_NAME}
        date={currentDate}
        onPrev={() =>
          setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
        }
        onToday={() => setCurrentDate(new Date())}
        onNext={() =>
          setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
        }
      />

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
          管理画面へのアクセス履歴を確認し、許可 IP の選定に利用します（モック）。
        </p>

        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">現在のアクセス元 IP（仮）</div>
              <div className="text-xs text-slate-500">この値で「許可/拒否」を判定し、アクセスログにも記録されます。</div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <input
                value={draftIp}
                onChange={(e) => setDraftIp(e.target.value)}
                placeholder="例: 203.0.113.10"
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50 sm:w-[220px]"
              />
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                onClick={() => setCurrentIp(draftIp)}
              >
                反映
              </button>
            </div>
          </div>
          {currentIp ? (
            <div className="mt-3 text-xs text-slate-500">
              現在：<span className="font-semibold text-slate-800">{currentIp}</span>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-500">未設定（`/admin` 側のガード画面で設定できます）</div>
          )}
        </div>

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
                  onChange={(e) => setAccessLogEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-slate-900"
                />
                {accessLogEnabled ? "ON" : "OFF"}
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => clearLogs()}
              >
                ログをクリア（仮）
              </button>
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
                  onClick={() => {
                    const ip = newIp.trim();
                    if (!ip) return;
                    addAllowedIp(ip);
                    setNewIp("");
                  }}
                >
                  追加
                </button>
              </div>

              <ul className="divide-y divide-slate-200/70 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
                {allowedIps.map((ip) => (
                  <li key={ip} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="text-sm font-medium text-slate-800">{ip}</div>
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => removeAllowedIp(ip)}
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
          <div className="grid grid-cols-[160px_1fr_120px_1fr] bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
            <div>日時</div>
            <div>IP</div>
            <div>結果</div>
            <div>ページ</div>
          </div>
          <ul className="divide-y divide-slate-200/70 bg-white">
            {visible.map((l) => (
              <li
                key={l.id}
                className="grid grid-cols-[160px_1fr_120px_1fr] items-center gap-3 px-3 py-3"
              >
                <div className="text-sm text-slate-700">{l.at}</div>
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
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}


