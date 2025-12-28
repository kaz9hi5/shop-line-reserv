"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatTreatmentDescription } from "@/lib/treatments";

type Treatment = {
  id?: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceYen: number;
};

export function TreatmentModal({
  treatment,
  mode,
  onClose,
  onSubmit
}: {
  treatment?: Treatment | null;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (treatment: Treatment) => void | Promise<void>;
}) {
  const [name, setName] = useState<string>(treatment?.name || "");
  const [description, setDescription] = useState<string>(treatment?.description || "");
  const [durationMinutes, setDurationMinutes] = useState<number>(treatment?.durationMinutes || 60);
  const [priceYen, setPriceYen] = useState<number>(treatment?.priceYen || 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (treatment) {
      setName(treatment.name);
      setDescription(treatment.description);
      setDurationMinutes(treatment.durationMinutes);
      setPriceYen(treatment.priceYen);
    }
  }, [treatment]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (durationMinutes < 1) return;
    if (priceYen < 0) return;

    try {
      setSaving(true);
      const formattedDescription = formatTreatmentDescription(description);
      await onSubmit({
        id: treatment?.id,
        name: name.trim(),
        description: formattedDescription,
        durationMinutes,
        priceYen
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={mode === "create" ? "施術メニュー追加" : "施術メニュー編集"}
      onClose={onClose}
      disableEscape={true}
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
            onClick={handleSubmit}
            disabled={saving || !name.trim() || durationMinutes < 1 || priceYen < 0}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="施術内容名（必須）">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：ジェルネイル"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="施術内容の概要（必須）">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：シンプルなワンカラー。オフィスにもおすすめ。"
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
          <p className="mt-1 text-xs text-slate-500">
            改行は自動的にフォーマットされます。
          </p>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="施術時間（分）">
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              min={1}
              max={1440}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            />
          </Field>
          <Field label="価格（円）">
            <input
              type="number"
              value={priceYen}
              onChange={(e) => setPriceYen(Number(e.target.value))}
              min={0}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            />
          </Field>
        </div>
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

