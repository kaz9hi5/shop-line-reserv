"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { AdminReservation } from "@/components/admin/reservationTypes";

type MenuOption = {
  id: string;
  label: string;
  durationMinutes: number;
  priceYen: number;
};

const dummyMenus: MenuOption[] = [
  { id: "gel", label: "ジェルネイル", durationMinutes: 60, priceYen: 5000 },
  { id: "foot", label: "フットネイル", durationMinutes: 90, priceYen: 7000 },
  { id: "care", label: "ケアコース", durationMinutes: 30, priceYen: 3000 }
];

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
  onSubmit: (r: AdminReservation) => void;
}) {
  const [name, setName] = useState<string>(() => initialReservation?.name ?? "");
  const [phoneLast4, setPhoneLast4] = useState<string>(() => initialReservation?.phoneLast4 ?? "");
  const [time, setTime] = useState<string>(() => initialReservation?.time ?? initialTime);
  const [menuId, setMenuId] = useState<string>(() => {
    const found = dummyMenus.find((m) => m.label === initialReservation?.menu)?.id;
    return found ?? dummyMenus[0].id;
  });

  const selectedMenu = useMemo(
    () => dummyMenus.find((m) => m.id === menuId) ?? dummyMenus[0],
    [menuId]
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
            onClick={() => {
              if (!name.trim()) return;
              if (!/^\d{4}$/.test(phoneLast4.trim())) return;
              const r: AdminReservation = {
                id: initialReservation?.id ?? crypto.randomUUID(),
                dateYmd,
                time,
                name: name.trim(),
                phoneLast4: phoneLast4.trim(),
                menu: selectedMenu.label,
                durationMinutes: selectedMenu.durationMinutes,
                priceYen: selectedMenu.priceYen,
                via: initialReservation?.via ?? "phone"
              };
              onSubmit(r);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            保存
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
        <Field label="電話番号（下4桁）">
          <input
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="1234"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="施術内容（メニュー）">
          <select
            value={menuId}
            onChange={(e) => setMenuId(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          >
            {dummyMenus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}（{m.durationMinutes}分 / ¥{m.priceYen.toLocaleString("ja-JP")}）
              </option>
            ))}
          </select>
        </Field>
        <Field label="施術時間 / 価格">
          <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-700">
            {selectedMenu.durationMinutes}分 / ¥{selectedMenu.priceYen.toLocaleString("ja-JP")}
          </div>
        </Field>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        ※ 現在はUI確認用のダミー動作です。後でSupabaseに接続します。
      </p>
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


