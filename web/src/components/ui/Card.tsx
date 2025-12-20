import { type ReactNode } from "react";

export function Card({
  title,
  right,
  children
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white/85 p-4 shadow-soft ring-1 ring-slate-200/70 backdrop-blur sm:p-5">
      {title ? (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
          {right ? <div className="text-xs text-slate-500">{right}</div> : null}
        </div>
      ) : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}


