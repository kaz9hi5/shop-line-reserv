"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { AdminReservation } from "@/components/admin/reservationTypes";
import { getTreatments } from "@/lib/treatments";
import type { Database } from "@/lib/database.types";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];

export function ReservationCreateModal({
  dateYmd,
  initialTime,
  mode,
  initialReservation,
  onClose,
  onSubmit
}: {
  dateYmd: string;
  initialTime: string;
  mode: "create" | "edit";
  initialReservation?: AdminReservation;
  onClose: () => void;
  onSubmit: (r: AdminReservation, treatmentId: string, lineUserId: string) => void | Promise<void>;
}) {
  const [name, setName] = useState<string>(() => initialReservation?.name ?? "");
  const [lineUserId, setLineUserId] = useState<string>(() => initialReservation?.lineUserId ?? "");
  const [lineDisplayName, setLineDisplayName] = useState<string>(() => initialReservation?.lineDisplayName ?? "");
  const [time, setTime] = useState<string>(() => initialReservation?.time ?? initialTime);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  const [menuId, setMenuId] = useState<string>(() => {
    // Will be set after treatments load
    return "";
  });

  // Load treatments
  useEffect(() => {
    async function loadTreatments() {
      try {
        setLoadingTreatments(true);
        const data = await getTreatments();
        setTreatments(data);
        if (data.length > 0) {
          // Set initial menu ID
          if (initialReservation?.menu) {
            const found = data.find((t) => t.name === initialReservation.menu);
            if (found) {
              setMenuId(found.id);
            } else {
              setMenuId(data[0].id);
            }
          } else {
            setMenuId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load treatments:", err);
      } finally {
        setLoadingTreatments(false);
      }
    }

    loadTreatments();
  }, [initialReservation?.menu]);

  const selectedMenu = useMemo(
    () => treatments.find((t) => t.id === menuId),
    [treatments, menuId]
  );

  return (
    <Modal
      title={mode === "create" ? "予約作成" : "予約変更"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!name.trim()) return;
              if (!lineUserId.trim()) return;
              if (!selectedMenu) return;

              const r: AdminReservation = {
                id: initialReservation?.id ?? crypto.randomUUID(),
                dateYmd,
                time,
                name: name.trim(),
                lineUserId: lineUserId.trim(),
                lineDisplayName: lineDisplayName.trim() || undefined,
                menu: selectedMenu.name,
                durationMinutes: selectedMenu.duration_minutes,
                priceYen: selectedMenu.price_yen,
                via: initialReservation?.via ?? "phone"
              };
              await onSubmit(r, selectedMenu.id, lineUserId.trim());
            }}
            disabled={!selectedMenu || loadingTreatments || !lineUserId.trim()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingTreatments ? "読み込み中..." : "保存"}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="日付">
          <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-700">
            {dateYmd}
          </div>
        </Field>
        <Field label="時間">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="お名前">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：山田 花子"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="LINEユーザーID">
          <input
            value={lineUserId}
            onChange={(e) => setLineUserId(e.target.value)}
            placeholder="例：U1234567890abcdef1234567890abcdef"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="LINE表示名（任意）">
          <input
            value={lineDisplayName}
            onChange={(e) => setLineDisplayName(e.target.value)}
            placeholder="例：山田 花子"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="施術内容（メニュー）">
          {loadingTreatments ? (
            <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-500">
              読み込み中...
            </div>
          ) : treatments.length === 0 ? (
            <div className="h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium leading-10 text-red-700">
              施術メニューが登録されていません
            </div>
          ) : (
            <select
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            >
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.duration_minutes}分 / ¥{t.price_yen.toLocaleString("ja-JP")}）
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="施術時間 / 価格">
          <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-700">
            {selectedMenu
              ? `${selectedMenu.duration_minutes}分 / ¥${selectedMenu.price_yen.toLocaleString("ja-JP")}`
              : "—"}
          </div>
        </Field>
      </div>

    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>
      {children}
    </label>
  );
}


