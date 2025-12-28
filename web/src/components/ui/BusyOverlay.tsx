"use client";

export function BusyOverlay({
  active,
  label = "保存中..."
}: {
  active: boolean;
  label?: string;
}) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
      <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg ring-1 ring-slate-200/80">
        {label}
      </div>
    </div>
  );
}


