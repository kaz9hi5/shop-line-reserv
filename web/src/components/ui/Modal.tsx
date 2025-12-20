"use client";

import { useEffect } from "react";

export function Modal({
  title,
  children,
  onClose,
  footer
}: {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        ) : null}

        <div className="px-5 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200/70 bg-slate-50/60 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}


