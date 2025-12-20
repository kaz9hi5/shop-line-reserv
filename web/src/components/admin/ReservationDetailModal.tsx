"use client";

import type { AdminReservation } from "@/components/admin/reservationTypes";
import { Modal } from "@/components/ui/Modal";

export function ReservationDetailModal({
  reservation,
  onClose,
  onEdit,
  onCancel,
  onResendSms
}: {
  reservation: AdminReservation;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onResendSms: () => void;
}) {
  return (
    <Modal
      title="予約詳細"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onResendSms}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            📩 SMS再送
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-900 shadow-sm hover:bg-orange-100"
          >
            ❌ キャンセル
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            ✏️ 変更
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="お名前" value={reservation.name} />
        <Field label="電話番号" value={`****${reservation.phoneLast4}`} />
        <Field label="日時" value={`${reservation.dateYmd} ${reservation.time}`} />
        <Field label="施術" value={reservation.menu} />
        <Field label="施術時間" value={`${reservation.durationMinutes}分`} />
        <Field label="価格" value={`¥${reservation.priceYen.toLocaleString("ja-JP")}`} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
        <div className="text-xs font-semibold text-slate-700">ステータス</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">予約あり</div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}


