"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DayCalendar } from "@/components/admin/DayCalendar";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { MonthCalendar } from "@/components/admin/MonthCalendar";
import type { AdminReservation } from "@/components/admin/reservationTypes";
import { ReservationDetailModal } from "@/components/admin/ReservationDetailModal";
import { ReservationCreateModal } from "@/components/admin/ReservationCreateModal";
import {
  getAdminReservationsByDate,
  getReservedDates,
  markReservationArrived,
  cancelReservation,
  createReservationFromAdmin,
  changeReservation
} from "@/lib/reservations";
import { getTreatments } from "@/lib/treatments";
import { resendSms } from "@/lib/edge-functions";

const SHOP_NAME = "〇〇ネイルサロン";

function toYmd(date: Date) {
  // local timezone safe enough for UI; later we can switch to a proper TZ handling
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AdminPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  const ymd = useMemo(() => toYmd(currentDate), [currentDate]);
  const month = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);

  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [reservedDateYmds, setReservedDateYmds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load reservations for current date
  useEffect(() => {
    let cancelled = false;

    async function loadReservations() {
      try {
        setLoading(true);
        setError(null);

        const data = await getAdminReservationsByDate(currentDate);
        if (!cancelled) {
          setReservations(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "予約の取得に失敗しました");
          console.error("Failed to load reservations:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReservations();

    return () => {
      cancelled = true;
    };
  }, [currentDate]);

  // Load reserved dates for calendar
  useEffect(() => {
    let cancelled = false;

    async function loadReservedDates() {
      try {
        const dates = await getReservedDates(
          currentDate.getFullYear(),
          currentDate.getMonth()
        );
        if (!cancelled) {
          setReservedDateYmds(dates);
        }
      } catch (err) {
        console.error("Failed to load reserved dates:", err);
      }
    }

    loadReservedDates();

    return () => {
      cancelled = true;
    };
  }, [currentDate]);

  const [detail, setDetail] = useState<AdminReservation | null>(null);
  const [create, setCreate] = useState<{ time: string } | null>(null);
  const [edit, setEdit] = useState<AdminReservation | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const handleArrive = async (r: AdminReservation) => {
    try {
      await markReservationArrived(r.id);
      // Reload reservations to reflect the change
      const data = await getAdminReservationsByDate(currentDate);
      setReservations(data);
      setFlash("来店を確認しました。予約キャンセル・変更回数をリセットしました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "来店確認に失敗しました"}`);
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="当月カレンダー">
          <MonthCalendar
            month={month}
            selectedDate={currentDate}
            onSelectDate={(d) => setCurrentDate(d)}
            reservedDateYmds={reservedDateYmds}
          />
        </Card>

        <Card title="予約状況一覧" right={ymd}>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">読み込み中...</div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-600">{error}</div>
          ) : (
            <DayCalendar
              date={currentDate}
              reservations={reservations}
              onClickReserved={(r) => setDetail(r)}
              onClickAvailable={(time) => setCreate({ time })}
              onArrive={handleArrive}
            />
          )}
        </Card>
      </div>

      {detail ? (
        <ReservationDetailModal
          reservation={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEdit(detail);
            setDetail(null);
          }}
          onCancel={async () => {
            try {
              await cancelReservation(detail.id);
              // Reload reservations
              const data = await getAdminReservationsByDate(currentDate);
              setReservations(data);
              setFlash("キャンセルしました（LINEメッセージ送信：仮 / キャンセル回数+1：仮）");
              setDetail(null);
            } catch (err) {
              setFlash(`エラー: ${err instanceof Error ? err.message : "キャンセルに失敗しました"}`);
            }
          }}
          onResendSms={async () => {
            try {
              await resendSms(detail.id);
              setFlash("LINEメッセージを再送しました");
            } catch (err) {
              setFlash(`エラー: ${err instanceof Error ? err.message : "LINEメッセージの再送に失敗しました"}`);
            }
          }}
        />
      ) : null}

      {create ? (
        <ReservationCreateModal
          mode="create"
          dateYmd={ymd}
          initialTime={create.time}
          onClose={() => setCreate(null)}
          onSubmit={async (r, treatmentId, lineUserId) => {
            try {
              await createReservationFromAdmin(r, treatmentId, lineUserId);
              // Reload reservations
              const data = await getAdminReservationsByDate(currentDate);
              setReservations(data);
              setFlash("予約を保存しました（LINEメッセージ送信：仮）");
              setCreate(null);
            } catch (err) {
              setFlash(`エラー: ${err instanceof Error ? err.message : "予約の作成に失敗しました"}`);
            }
          }}
        />
      ) : null}

      {edit ? (
        <ReservationCreateModal
          mode="edit"
          dateYmd={edit.dateYmd}
          initialTime={edit.time}
          initialReservation={edit}
          onClose={() => setEdit(null)}
          onSubmit={async (r, treatmentId, lineUserId) => {
            try {
              // 変更は「旧予約を論理削除→新規作成」の扱い（キャンセル回数は増やさない）
              await changeReservation(edit.id, r, treatmentId, lineUserId || edit.lineUserId || "");
              // Reload reservations
              const data = await getAdminReservationsByDate(currentDate);
              setReservations(data);
              setFlash("変更を保存しました（LINEメッセージ送信：仮 / 変更回数+1：仮 / キャンセル回数は増えません）");
              setEdit(null);
            } catch (err) {
              setFlash(`エラー: ${err instanceof Error ? err.message : "予約の変更に失敗しました"}`);
            }
          }}
        />
      ) : null}
    </div>
  );
}


