"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { createStaff, deleteStaff, getActiveStaff, updateStaffName, type StaffRow } from "@/lib/staff";

const SHOP_NAME = "〇〇ネイルサロン";

export default function AdminMembersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const data = await getActiveStaff();
    setRows(data);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e) {
        setFlash(`エラー: ${e instanceof Error ? e.message : "読み込みに失敗しました"}`);
      } finally {
        setLoading(false);
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

  return (
    <div className="space-y-4">
      <BusyOverlay active={saving} label="保存中..." />
      <AdminHeader shopName={SHOP_NAME} />
      <AdminNav />

      <div className="grid gap-4">
        <Card title="メンバー編集（店長のみ）">
          {flash ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200/60">
              <div className="min-w-0 truncate">{flash}</div>
              <button
                type="button"
                onClick={dismissFlash}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-rose-700/80 hover:bg-rose-100"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-slate-600">店員名</div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例：山田"
                className="h-10 w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
              />
            </label>
            <button
              type="button"
              disabled={saving || !newName.trim()}
              onClick={async () => {
                try {
                  setSaving(true);
                  setFlash(null);
                  await createStaff(newName.trim());
                  setNewName("");
                  await reload();
                } catch (e) {
                  setFlash(`エラー: ${e instanceof Error ? e.message : "追加に失敗しました"}`);
                } finally {
                  setSaving(false);
                }
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              追加
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[520px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-xs font-semibold text-slate-600">
                  <th className="border-b border-slate-200 px-2 py-2" align="left">名前</th>
                  <th className="border-b border-slate-100 px-2 py-2" align="left">&nbsp;&nbsp;ロール</th>
                  <th className="border-b border-slate-100 px-2 py-2" align="left">&nbsp;&nbsp;&nbsp;操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-2 py-3 text-sm text-slate-500" colSpan={3}>
                      読み込み中...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((r) => (
                    <RowItem
                      key={r.id}
                      row={r}
                      setGlobalSaving={setSaving}
                      onUpdated={async () => reload()}
                      onDeleted={async () => reload()}
                      setFlash={setFlash}
                    />
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-3 text-sm text-slate-500" colSpan={3}>
                      メンバーがいません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RowItem({
  row,
  setGlobalSaving,
  onUpdated,
  onDeleted,
  setFlash
}: {
  row: StaffRow;
  setGlobalSaving: (v: boolean) => void;
  onUpdated: () => Promise<void>;
  onDeleted: () => Promise<void>;
  setFlash: (msg: string | null) => void;
}) {
  const [name, setName] = useState(row.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isManager = row.role === "manager";

  return (
    <tr className="text-sm text-slate-800">
      <td className="border-b border-slate-100 px-2 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
        />
      </td>
      <td className="border-b border-slate-100 px-2 py-2">
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {isManager ? "店長" : "店員"}
        </span>
      </td>
      <td className="border-b border-slate-100 px-2 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || name.trim() === row.name}
            onClick={async () => {
              try {
                setSaving(true);
                setGlobalSaving(true);
                setFlash(null);
                await updateStaffName(row.id, name.trim());
                await onUpdated();
              } catch (e) {
                setFlash(`エラー: ${e instanceof Error ? e.message : "更新に失敗しました"}`);
              } finally {
                setSaving(false);
                setGlobalSaving(false);
              }
            }}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            disabled={deleting || isManager}
            onClick={async () => {
              if (!confirm(`${row.name} を削除します。よろしいですか？`)) return;
              try {
                setDeleting(true);
                setGlobalSaving(true);
                setFlash(null);
                await deleteStaff(row.id);
                await onDeleted();
              } catch (e) {
                setFlash(`エラー: ${e instanceof Error ? e.message : "削除に失敗しました"}`);
              } finally {
                setDeleting(false);
                setGlobalSaving(false);
              }
            }}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            削除
          </button>
          {isManager ? (
            <div className="text-xs text-slate-500 self-center">※店長は削除不可</div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}


