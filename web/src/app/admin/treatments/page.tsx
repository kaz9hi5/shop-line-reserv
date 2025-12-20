"use client";

import { useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";

const SHOP_NAME = "〇〇ネイルサロン";

type TreatmentStub = {
  id: string;
  name: string;
  durationMinutes: number;
  priceYen: number;
  description: string;
};

function formatYen(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(amount);
}

export default function AdminTreatmentsPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  const treatments = useMemo<TreatmentStub[]>(
    () => [
      {
        id: "t1",
        name: "ジェル（ワンカラー）",
        durationMinutes: 60,
        priceYen: 6500,
        description: "シンプルなワンカラー。オフィスにもおすすめ。"
      },
      {
        id: "t2",
        name: "フット（ワンカラー）",
        durationMinutes: 75,
        priceYen: 7500,
        description: "足元をきれいに整えてカラーリングします。"
      }
    ],
    []
  );

  return (
    <div className="space-y-4">
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

      <Card title="施術内容管理">
        <p className="text-sm leading-6 text-slate-600">
          施術内容には <span className="font-semibold">概要</span>・
          <span className="font-semibold">施術時間</span>・
          <span className="font-semibold">価格（円）</span> を登録します。
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
          <div className="grid grid-cols-[1fr_90px_120px] bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
            <div>メニュー</div>
            <div>時間</div>
            <div>価格</div>
          </div>
          <ul className="divide-y divide-slate-200/70 bg-white">
            {treatments.map((t) => (
              <li key={t.id} className="px-3 py-3">
                <div className="grid grid-cols-[1fr_90px_120px] items-baseline gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{t.name}</div>
                    <div className="mt-0.5 text-sm text-slate-600">{t.description}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{t.durationMinutes}分</div>
                  <div className="text-sm font-semibold text-slate-800">{formatYen(t.priceYen)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => {
              // ダミー：追加/編集は次にモーダルで実装
              // eslint-disable-next-line no-console
              console.log("open treatment modal");
            }}
          >
            ＋ 施術を追加（仮）
          </button>
        </div>
      </Card>
    </div>
  );
}


