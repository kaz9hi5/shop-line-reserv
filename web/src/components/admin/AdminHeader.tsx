"use client";

import { memo } from "react";

type Props = {
  shopName: string;
};

export const AdminHeader = memo(function AdminHeader({
  shopName
}: Props) {
  return (
    <header className="rounded-2xl bg-white/85 px-4 py-4 shadow-soft ring-1 ring-slate-200/70 backdrop-blur sm:px-5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">管理画面</p>
        <h1 className="truncate text-lg font-semibold tracking-tight text-slate-800">{shopName}</h1>
      </div>
    </header>
  );
});
