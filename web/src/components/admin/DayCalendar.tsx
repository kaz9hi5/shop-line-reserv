"use client";

import { useMemo } from "react";
import type { AdminReservation } from "@/components/admin/reservationTypes";

function buildTimeSlots(startHour = 10, endHour = 19, intervalMinutes = 60) {
  const out: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      out.push(`${hh}:${mm}`);
    }
  }
  return out;
}

export function DayCalendar({
  date,
  reservations,
  onClickReserved,
  onClickAvailable
}: {
  date: Date;
  reservations: AdminReservation[];
  onClickReserved: (r: AdminReservation) => void;
  onClickAvailable: (time: string) => void;
}) {
  const byTime = useMemo(() => new Map(reservations.map((r) => [r.time, r])), [reservations]);
  const slots = useMemo(() => buildTimeSlots(10, 19, 60), []);

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
      <div className="grid grid-cols-[80px_1fr] bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
        <div>時間</div>
        <div>予約</div>
      </div>

      <ul className="divide-y divide-slate-200/70 bg-white">
        {slots.map((time) => {
          const item = byTime.get(time);
          const reserved = Boolean(item);
          return (
            <li
              key={time}
              className={[
                "grid grid-cols-[80px_1fr] items-center gap-3 px-3 py-3",
                reserved ? "bg-white" : "bg-white hover:bg-slate-50/60"
              ].join(" ")}
            >
              <div className="text-sm font-medium text-slate-700">{time}</div>

              {reserved ? (
                <button
                  type="button"
                  onClick={() => onClickReserved(item!)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50/60"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200/70">
                    <IconCalendarCheck className="h-3.5 w-3.5" />
                    予約あり
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{item!.name}</span>
                  <span className="text-sm text-slate-600">/ {item!.menu}</span>
                  <span className="text-xs text-slate-500">（****{item!.phoneLast4}）</span>
                  {item!.via === "phone" ? (
                    <span className="text-xs text-slate-500">（電話）</span>
                  ) : null}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onClickAvailable(time)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50/60"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200/70">
                    <IconSparkle className="h-3.5 w-3.5" />
                    空き
                  </span>
                  <span className="text-sm text-slate-500">クリックで予約作成</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconCalendarCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 3v2M16 3v2M4.5 8.5h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 5.5h11A2 2 0 0 1 19.5 7.5v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 14.2l1.8 1.8L15.5 11.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 3l1.2 4.2L17.5 9 13.2 10.8 12 15l-1.2-4.2L6.5 9l4.3-1.8L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 13.5l.7 2.2 2.3.8-2.3.8-.7 2.2-.7-2.2-2.3-.8 2.3-.8.7-2.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}


