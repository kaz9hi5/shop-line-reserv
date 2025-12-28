"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { TreatmentModal } from "@/components/admin/TreatmentModal";
import { getTreatments, createTreatment, updateTreatment, deleteTreatment } from "@/lib/treatments";
import type { Database } from "@/lib/database.types";

const SHOP_NAME = "〇〇ネイルサロン";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];

function formatYen(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(amount);
}

export default function AdminTreatmentsPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [creatingTreatment, setCreatingTreatment] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load treatments
  useEffect(() => {
    async function loadTreatments() {
      try {
        setLoading(true);
        const data = await getTreatments();
        setTreatments(data);
      } catch (err) {
        setFlash(`エラー: ${err instanceof Error ? err.message : "施術メニューの読み込みに失敗しました"}`);
        console.error("Failed to load treatments:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTreatments();
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

  const handleCreate = async (treatment: { name: string; description: string; durationMinutes: number; priceYen: number }) => {
    try {
      setSaving(true);
      await createTreatment({
        name: treatment.name,
        description: treatment.description,
        duration_minutes: treatment.durationMinutes,
        price_yen: treatment.priceYen
      });
      // Reload treatments
      const data = await getTreatments();
      setTreatments(data);
      setCreatingTreatment(false);
      setFlash("施術メニューを追加しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "施術メニューの追加に失敗しました"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (treatment: { id?: string; name: string; description: string; durationMinutes: number; priceYen: number }) => {
    if (!treatment.id) return;
    try {
      setSaving(true);
      await updateTreatment(treatment.id, {
        name: treatment.name,
        description: treatment.description,
        duration_minutes: treatment.durationMinutes,
        price_yen: treatment.priceYen
      });
      // Reload treatments
      const data = await getTreatments();
      setTreatments(data);
      setEditingTreatment(null);
      setFlash("施術メニューを更新しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "施術メニューの更新に失敗しました"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この施術メニューを削除しますか？")) return;
    try {
      setSaving(true);
      await deleteTreatment(id);
      // Reload treatments
      const data = await getTreatments();
      setTreatments(data);
      setFlash("施術メニューを削除しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "施術メニューの削除に失敗しました"}`);
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

      <Card title="施術内容管理">
        <p className="text-sm leading-6 text-slate-600">
          施術内容には <span className="font-semibold">概要</span>・
          <span className="font-semibold">施術時間</span>・
          <span className="font-semibold">価格（円）</span> を登録します。
        </p>

        {loading ? (
          <div className="mt-4 py-8 text-center text-sm text-slate-500">読み込み中...</div>
        ) : (
          <>
            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
              <div className="grid grid-cols-[1fr_90px_120px_120px] bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
                <div>メニュー</div>
                <div>時間</div>
                <div>価格</div>
                <div>操作</div>
              </div>
              <ul className="divide-y divide-slate-200/70 bg-white">
                {treatments.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-slate-500">
                    施術メニューが登録されていません
                  </li>
                ) : (
                  treatments.map((t) => (
                    <li key={t.id} className="px-3 py-3">
                      <div className="grid grid-cols-[1fr_90px_120px_120px] items-baseline gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{t.name}</div>
                          <div className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{t.description}</div>
                        </div>
                        <div className="text-sm font-medium text-slate-700">{t.duration_minutes}分</div>
                        <div className="text-sm font-semibold text-slate-800">{formatYen(t.price_yen)}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingTreatment(t)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-red-200 bg-white px-3 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setCreatingTreatment(true)}
              >
                ＋ 施術を追加
              </button>
            </div>
          </>
        )}
      </Card>

      {creatingTreatment ? (
        <TreatmentModal
          mode="create"
          treatment={null}
          onClose={() => setCreatingTreatment(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      {editingTreatment ? (
        <TreatmentModal
          mode="edit"
          treatment={{
            id: editingTreatment.id,
            name: editingTreatment.name,
            description: editingTreatment.description,
            durationMinutes: editingTreatment.duration_minutes,
            priceYen: editingTreatment.price_yen
          }}
          onClose={() => setEditingTreatment(null)}
          onSubmit={handleUpdate}
        />
      ) : null}
    </div>
  );
}


