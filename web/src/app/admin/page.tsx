"use client";

import { useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DayCalendar } from "@/components/admin/DayCalendar";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { MonthCalendar } from "@/components/admin/MonthCalendar";
import type { AdminReservation } from "@/components/admin/reservationTypes";
import { ReservationDetailModal } from "@/components/admin/ReservationDetailModal";
import { ReservationCreateModal } from "@/components/admin/ReservationCreateModal";

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
  const reservedDateYmds = useMemo(() => {
    // NOTE: デザイン用ダミーデータ。後でSupabaseの予約から集計する。
    const s = new Set<string>();
    const base = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    s.add(toYmd(new Date())); // today
    s.add(toYmd(new Date(base.getFullYear(), base.getMonth(), 5)));
    s.add(toYmd(new Date(base.getFullYear(), base.getMonth(), 12)));
    s.add(toYmd(new Date(base.getFullYear(), base.getMonth(), 18)));
    return s;
  }, [currentDate]);

  // NOTE: デザイン確認用の簡易状態。後でSupabaseに置き換える。
  const [reservationsByDate, setReservationsByDate] = useState<Record<string, AdminReservation[]>>(() => {
    const today = toYmd(new Date());
    return {
      [today]: [
        {
          id: "r1",
          dateYmd: today,
          time: "10:00",
          name: "山田様",
          phoneLast4: "1234",
          menu: "ジェルネイル",
          durationMinutes: 60,
          priceYen: 5000,
          via: "web"
        },
        {
          id: "r2",
          dateYmd: today,
          time: "13:00",
          name: "電話予約",
          phoneLast4: "0000",
          menu: "—",
          durationMinutes: 90,
          priceYen: 0,
          via: "phone"
        },
        {
          id: "r3",
          dateYmd: today,
          time: "14:00",
          name: "佐藤様",
          phoneLast4: "5678",
          menu: "フットネイル",
          durationMinutes: 60,
          priceYen: 7000,
          via: "web"
        }
      ]
    };
  });

  const reservations = useMemo(() => reservationsByDate[ymd] ?? [], [reservationsByDate, ymd]);

  const [detail, setDetail] = useState<AdminReservation | null>(null);
  const [create, setCreate] = useState<{ time: string } | null>(null);
  const [edit, setEdit] = useState<AdminReservation | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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
          <DayCalendar
            date={currentDate}
            reservations={reservations}
            onClickReserved={(r) => setDetail(r)}
            onClickAvailable={(time) => setCreate({ time })}
          />
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
          onCancel={() => {
            setReservationsByDate((prev) => ({
              ...prev,
              [detail.dateYmd]: (prev[detail.dateYmd] ?? []).filter((x) => x.id !== detail.id)
            }));
            setFlash("キャンセルしました（SMS送信：仮）");
            setDetail(null);
          }}
          onResendSms={() => {
            // eslint-disable-next-line no-console
            console.log("SMS再送（仮）", detail);
            setFlash("SMSを再送しました（仮）");
          }}
        />
      ) : null}

      {create ? (
        <ReservationCreateModal
          mode="create"
          dateYmd={ymd}
          initialTime={create.time}
          onClose={() => setCreate(null)}
          onSubmit={(r) => {
            setReservationsByDate((prev) => ({
              ...prev,
              [ymd]: [...(prev[ymd] ?? []).filter((x) => x.id !== r.id), r].sort((a, b) =>
                a.time.localeCompare(b.time)
              )
            }));
            setFlash("予約を保存しました（SMS送信：仮）");
            setCreate(null);
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
          onSubmit={(r) => {
            setReservationsByDate((prev) => ({
              ...prev,
              [edit.dateYmd]: [...(prev[edit.dateYmd] ?? []).filter((x) => x.id !== r.id), r].sort((a, b) =>
                a.time.localeCompare(b.time)
              )
            }));
            setFlash("変更を保存しました（SMS送信：仮）");
            setEdit(null);
          }}
        />
      ) : null}
    </div>
  );
}


