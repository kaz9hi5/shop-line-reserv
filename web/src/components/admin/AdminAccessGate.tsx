"use client";

import { useState } from "react";
import { useAdminAccess } from "@/components/admin/AdminAccessContext";
import { Card } from "@/components/ui/Card";

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const { currentIp, setCurrentIp, allowedIps, isAllowed, addAllowedIp } = useAdminAccess();
  const [draft, setDraft] = useState<string>(currentIp);

  if (!currentIp) {
    return (
      <Card title="管理画面アクセス（モック）">
        <p className="text-sm leading-6 text-slate-700">
          現在のアクセス元 IP（仮）を入力してください。許可 IP リストに含まれる場合のみ管理画面を表示します。
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例: 203.0.113.10"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
          <button
            type="button"
            onClick={() => setCurrentIp(draft)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            設定
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          ※ モック：実IP取得は後で実装します。許可IPを編集すると、追加＝許可／削除＝拒否になります。
        </p>
      </Card>
    );
  }

  if (!isAllowed) {
    return (
      <Card title="403（アクセス拒否）">
        <p className="text-sm leading-6 text-slate-700">
          この IP（<span className="font-semibold">{currentIp}</span>）は許可リストに存在しないため、管理画面へアクセスできません。
        </p>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-xs font-semibold text-slate-600">許可リスト（現在）</div>
          <div className="mt-1 text-sm text-slate-700">
            {allowedIps.length ? allowedIps.join(", ") : "（空）"}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addAllowedIp(currentIp)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            このIPを許可リストに追加（仮）
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentIp("");
              setDraft("");
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            IPを変更
          </button>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}


