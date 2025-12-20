"use client";

import { useMemo } from "react";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeekMonday(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // Monday=0
  date.setDate(date.getDate() - diff);
  return date;
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthTitle(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}年${m}月`;
}

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;

export function MonthCalendar({
  month,
  selectedDate,
  onSelectDate,
  reservedDateYmds
}: {
  month: Date; // any date inside month
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  reservedDateYmds?: Set<string>;
}) {
  const first = useMemo(() => startOfMonth(month), [month]);
  const last = useMemo(() => endOfMonth(month), [month]);
  const gridStart = useMemo(() => startOfWeekMonday(first), [first]);

  const days = useMemo(() => {
    const out: Date[] = [];
    // 6 weeks * 7 days = 42 cells (covers all months)
    for (let i = 0; i < 42; i++) out.push(addDays(gridStart, i));
    return out;
  }, [gridStart]);

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between bg-slate-100/70 px-3 py-2">
        <div className="text-sm font-semibold tracking-tight text-slate-800">
          {formatMonthTitle(month)}
        </div>
        <div className="text-xs text-slate-500">週の始まり：月</div>
      </div>

      <div className="grid grid-cols-7 bg-white">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="border-b border-slate-200/70 px-2 py-2 text-center text-xs font-semibold text-slate-600"
          >
            {w}
          </div>
        ))}

        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, new Date());
          const hasReservation = reservedDateYmds?.has(formatYmd(d)) ?? false;

          return (
            <button
              key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
              type="button"
              onClick={() => onSelectDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
              className={[
                "relative h-11 border-b border-slate-200/70 px-2 text-sm transition-colors",
                "hover:bg-slate-50",
                selected ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-800",
                !inMonth && !selected ? "text-slate-400" : "",
                "focus:outline-none focus:ring-2 focus:ring-slate-400/50"
              ].join(" ")}
            >
              <div className="flex h-full items-center justify-center">
                <span className="font-medium">{d.getDate()}</span>
              </div>

              {hasReservation ? (
                <span
                  className={[
                    "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                    selected ? "bg-white/90" : "bg-orange-400"
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : null}

              {isToday && !selected ? (
                <span
                  className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-slate-300"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="bg-white px-3 py-2 text-xs text-slate-500">
        {first.toISOString().slice(0, 10)} 〜 {last.toISOString().slice(0, 10)}
      </div>
    </div>
  );
}


