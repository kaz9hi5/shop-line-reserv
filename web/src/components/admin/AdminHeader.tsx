"use client";

import { memo } from "react";

function formatJapaneseDate(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
}

type Props = {
  shopName: string;
  date: Date;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
};

export const AdminHeader = memo(function AdminHeader({
  shopName,
  date,
  onPrev,
  onToday,
  onNext
}: Props) {
  return (
    <header className="rounded-2xl bg-white/85 px-4 py-4 shadow-soft ring-1 ring-slate-200/70 backdrop-blur sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">管理画面</p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-800">
            {shopName}
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="text-sm font-medium text-slate-700">{formatJapaneseDate(date)}</div>

          <div className="flex items-center gap-2">
            <HeaderButton onClick={onPrev} label="←" ariaLabel="前日" />
            <HeaderButton onClick={onToday} label="今日" ariaLabel="今日" />
            <HeaderButton onClick={onNext} label="→" ariaLabel="翌日" />
          </div>
        </div>
      </div>
    </header>
  );
});

function HeaderButton({
  label,
  ariaLabel,
  onClick
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
    >
      {label}
    </button>
  );
}


