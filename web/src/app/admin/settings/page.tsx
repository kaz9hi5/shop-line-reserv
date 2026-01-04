"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import {
  getAppSettings,
  updateAppSettings,
  getBusinessDays,
  getBusinessDaysForDate,
  upsertBusinessDay,
  deleteBusinessDay,
  getBusinessHoursOverrides,
  upsertBusinessHoursOverride,
  deleteBusinessHoursOverride
} from "@/lib/settings";
import { getActiveStaff, getCurrentStaffId, getCurrentStaffInfo } from "@/lib/staff";
import type { StaffRow } from "@/lib/staff";
import type { BusinessDay } from "@/lib/settings";

const SHOP_NAME = "〇〇ネイルサロン";

type DayStatus = "open" | "holiday" | "closed" | "unset";
type DayHoursOverride =
  | { enabled: false }
  | {
      enabled: true;
      openTime: string;
      closeTime: string;
      lunchOverrideEnabled: boolean; // false: デフォルト昼休憩を継承
      lunchStart?: string;
      lunchEnd?: string;
    };

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

function endOfWeekSunday(d: Date) {
  const start = startOfWeekMonday(d);
  return addDays(start, 6);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLabel(date: Date) {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}（${weekday}）`;
}

function formatTime(time: string): string {
  // HH:mm:ss または HH:mm 形式を HH:mm に変換
  return time.substring(0, 5);
}

export default function AdminSettingsPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [deadlineHours, setDeadlineHours] = useState<number>(24);
  const [lunchEnabled, setLunchEnabled] = useState<boolean>(false);
  const [lunchStart, setLunchStart] = useState<string>("12:00");
  const [lunchEnd, setLunchEnd] = useState<string>("13:00");

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const monthDays = useMemo(() => Array.from({ length: monthEnd.getDate() }, (_, i) => addDays(monthStart, i)), [monthStart, monthEnd]);

  const calendarStart = useMemo(() => startOfWeekMonday(monthStart), [monthStart]);
  const calendarEnd = useMemo(() => endOfWeekSunday(monthEnd), [monthEnd]);
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    for (let d = new Date(calendarStart); d <= calendarEnd; d = addDays(d, 1)) {
      days.push(d);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [dayHours, setDayHours] = useState<Record<string, DayHoursOverride>>({});
  const [selectedYmd, setSelectedYmd] = useState<string>(() => formatYmd(new Date()));
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [selectedDayStaffStatus, setSelectedDayStaffStatus] = useState<BusinessDay[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [staffInfo, setStaffInfo] = useState<{ role: "manager" | "staff" } | null>(null);

  // Load settings
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setLoading(true);

        // Get current user's staff ID
        const staffId = await getCurrentStaffId();
        if (!cancelled) {
          setCurrentStaffId(staffId);
        }

        // Get current user's staff info (for role check)
        const info = await getCurrentStaffInfo();
        if (!cancelled) {
          if (info && info.role) {
            setStaffInfo({ role: info.role });
          } else {
            setStaffInfo(null);
          }
        }

        // Load app settings (for both manager and staff - staff is read-only)
        try {
          const settings = await getAppSettings();
          if (!cancelled) {
            setOpenTime(settings.default_open_time);
            setCloseTime(settings.default_close_time);
            setDeadlineHours(settings.reservation_deadline_hours);
            setLunchEnabled(settings.default_lunch_enabled);
            setLunchStart(settings.default_lunch_start || "12:00");
            setLunchEnd(settings.default_lunch_end || "13:00");
          }
        } catch (settingsError) {
          // If settings load fails, skip it
          console.warn("Failed to load app settings:", settingsError);
        }

        // Load business days for month (filter by current user's staff_id)
        const businessDays = await getBusinessDays(monthStart, monthEnd);
        if (!cancelled) {
          const statusMap: Record<string, DayStatus> = {};
          for (const d of monthDays) {
            const ymd = formatYmd(d);
            const dayData = businessDays.find((bd) => bd.day === ymd && bd.staff_id === staffId);
            statusMap[ymd] = dayData ? (dayData.status as DayStatus) : "unset";
          }
          setDayStatus(statusMap);
        }

        // Load business hours overrides for month (filter by current user's staff_id)
        const overrides = await getBusinessHoursOverrides(monthStart, monthEnd);
        if (!cancelled) {
          const hoursMap: Record<string, DayHoursOverride> = {};
          for (const d of monthDays) {
            const ymd = formatYmd(d);
            const override = overrides.find((o) => o.day === ymd && o.staff_id === staffId);
            if (override) {
              hoursMap[ymd] = {
                enabled: true,
                openTime: override.open_time,
                closeTime: override.close_time,
                lunchOverrideEnabled: override.lunch_enabled,
                lunchStart: override.lunch_start || undefined,
                lunchEnd: override.lunch_end || undefined
              };
            } else {
              hoursMap[ymd] = { enabled: false };
            }
          }
          setDayHours(hoursMap);
        }

        // Load staff list
        const staff = await getActiveStaff();
        if (!cancelled) {
          setStaffList(staff);
        }
      } catch (err) {
        if (!cancelled) {
          setFlash(`エラー: ${err instanceof Error ? err.message : "設定の読み込みに失敗しました"}`);
          console.error("Failed to load settings:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [monthStart, monthEnd, monthDays]);

  // Load staff status for selected day
  useEffect(() => {
    let cancelled = false;

    async function loadSelectedDayStaffStatus() {
      try {
        const businessDays = await getBusinessDaysForDate(selectedYmd);
        if (!cancelled) {
          setSelectedDayStaffStatus(businessDays);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load staff status for selected day:", err);
          setSelectedDayStaffStatus([]);
        }
      }
    }

    loadSelectedDayStaffStatus();

    return () => {
      cancelled = true;
    };
  }, [selectedYmd]);

  const unsetCount = useMemo(() => {
    const todayYmd = formatYmd(new Date());
    return monthDays.filter((d) => {
      const ymd = formatYmd(d);
      // 過去日はカウントから除外
      if (ymd < todayYmd) {
        return false;
      }
      return (dayStatus[ymd] ?? "unset") === "unset";
    }).length;
  }, [monthDays, dayStatus]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setFlash(null);

      // Get current user's staff ID
      const staffId = await getCurrentStaffId();

      // Save app settings (only for manager)
      if (staffInfo?.role === "manager") {
        await updateAppSettings({
          default_open_time: openTime,
          default_close_time: closeTime,
          reservation_deadline_hours: deadlineHours,
          default_lunch_enabled: lunchEnabled,
          default_lunch_start: lunchEnabled ? lunchStart : null,
          default_lunch_end: lunchEnabled ? lunchEnd : null
        });
      }

      // Save business days
      for (const d of monthDays) {
        const ymd = formatYmd(d);
        const status = dayStatus[ymd] || "unset";
        if (status === "unset") {
          await deleteBusinessDay(ymd, staffId);
        } else {
          await upsertBusinessDay(ymd, status, staffId);
        }
      }

      // Save business hours overrides
      for (const d of monthDays) {
        const ymd = formatYmd(d);
        const hours = dayHours[ymd];
        if (!hours || !hours.enabled) {
          await deleteBusinessHoursOverride(ymd, staffId);
        } else {
          await upsertBusinessHoursOverride({
            day: ymd,
            open_time: hours.openTime,
            close_time: hours.closeTime,
            lunch_enabled: hours.lunchOverrideEnabled,
            lunch_start: hours.lunchOverrideEnabled ? hours.lunchStart || null : null,
            lunch_end: hours.lunchOverrideEnabled ? hours.lunchEnd || null : null,
            staff_id: staffId
          });
        }
      }

      setFlash("設定を保存しました");
    } catch (err) {
      setFlash(`エラー: ${err instanceof Error ? err.message : "設定の保存に失敗しました"}`);
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  // Auto-dismiss flash after 5000ms
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const dismissFlash = () => {
    setFlash(null);
  };

  return (
    <div className="space-y-4">
      <BusyOverlay active={saving} label="保存中..." />
      {flash ? (
        <div className="sticky top-3 z-40">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10">
              <div className="min-w-0 truncate">{flash}</div>
              <button
                type="button"
                onClick={dismissFlash}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminHeader shopName={SHOP_NAME} />

      <Card>
        <AdminNav />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card title="営業時間">
            <p className="text-sm leading-6 text-slate-600">
              デフォルト営業時間を基本とし、必要に応じて日毎（具体的な日付）に営業時間を上書きできます。
              昼休憩時間中は予約不可として扱います。
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="開始">
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  disabled={staffInfo?.role === "staff"}
                  readOnly={staffInfo?.role === "staff"}
                  className={[
                    "h-10 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50",
                    staffInfo?.role === "staff"
                      ? "bg-slate-50 text-slate-600 cursor-not-allowed"
                      : "bg-white text-slate-800"
                  ].join(" ")}
                />
              </Field>
              <Field label="終了">
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  disabled={staffInfo?.role === "staff"}
                  readOnly={staffInfo?.role === "staff"}
                  className={[
                    "h-10 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50",
                    staffInfo?.role === "staff"
                      ? "bg-slate-50 text-slate-600 cursor-not-allowed"
                      : "bg-white text-slate-800"
                  ].join(" ")}
                />
              </Field>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">昼休憩（デフォルト）</div>
                  <div className="text-xs text-slate-500">任意（ON の場合は昼休憩時間を予約不可にします）</div>
                </div>
                <label className={[
                  "flex items-center gap-2 text-sm font-medium",
                  staffInfo?.role === "staff" ? "text-slate-600" : "text-slate-700"
                ].join(" ")}>
                  <input
                    type="checkbox"
                    checked={lunchEnabled}
                    onChange={(e) => setLunchEnabled(e.target.checked)}
                    disabled={staffInfo?.role === "staff"}
                    readOnly={staffInfo?.role === "staff"}
                    className={[
                      "h-5 w-5 rounded border-slate-300 text-slate-900",
                      staffInfo?.role === "staff" ? "cursor-not-allowed" : ""
                    ].join(" ")}
                  />
                  {lunchEnabled ? "ON" : "OFF"}
                </label>
              </div>
              <div className="border-t border-slate-200/70 px-3 py-3">
                {lunchEnabled ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                      disabled={staffInfo?.role === "staff"}
                      readOnly={staffInfo?.role === "staff"}
                      className={[
                        "h-9 w-[120px] rounded-xl border border-slate-200 px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50",
                        staffInfo?.role === "staff"
                          ? "bg-slate-50 text-slate-600 cursor-not-allowed"
                          : "bg-white text-slate-800"
                      ].join(" ")}
                    />
                    <span className="text-xs text-slate-500">–</span>
                    <input
                      type="time"
                      value={lunchEnd}
                      onChange={(e) => setLunchEnd(e.target.value)}
                      disabled={staffInfo?.role === "staff"}
                      readOnly={staffInfo?.role === "staff"}
                      className={[
                        "h-9 w-[120px] rounded-xl border border-slate-200 px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50",
                        staffInfo?.role === "staff"
                          ? "bg-slate-50 text-slate-600 cursor-not-allowed"
                          : "bg-white text-slate-800"
                      ].join(" ")}
                    />
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">昼休憩なし（デフォルト）</div>
                )}
              </div>
            </div>
          </Card>

          <Card title="予約キャンセル・変更期限設定">
            <p className="text-sm leading-6 text-slate-600">
              予約日時から <span className="font-semibold">何時間前まで</span> キャンセル・変更できるかを設定します（1〜48時間）。
            </p>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={48}
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(Number(e.target.value))}
                disabled={staffInfo?.role === "staff"}
                readOnly={staffInfo?.role === "staff"}
                className={[
                  "w-full",
                  staffInfo?.role === "staff" ? "cursor-not-allowed" : ""
                ].join(" ")}
              />
              <div className={[
                "w-20 text-right text-sm font-semibold",
                staffInfo?.role === "staff" ? "text-slate-600" : "text-slate-800"
              ].join(" ")}>
                {deadlineHours}時間前まで
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              期限日時の計算/表示は、予約画面側で予約日時から差し引いて表示します。
            </p>
          </Card>
        </div>

        <Card
          title="営業日カレンダー"
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentDate((d) => addMonths(d, -1))}
                className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                ←
              </button>
              <span className="text-xs text-slate-600">
                {currentDate.getFullYear()}/{String(currentDate.getMonth() + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => setCurrentDate((d) => addMonths(d, 1))}
                className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                →
              </button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-slate-600">営業日設定は日付単位で行います。
          {unsetCount > 0 ? (
              <span className="text-xs leading-5 text-amber-900">
                この月に未設定の日付が {unsetCount} 件あります（予約画面には表示されません）。
              </span>
          ) : null}
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
              <div className="grid grid-cols-7 bg-slate-100/70 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-200/70">
                {calendarDays.map((d) => {
                  const ymd = formatYmd(d);
                  const inMonth = d.getMonth() === currentDate.getMonth();
                  const status = dayStatus[ymd] ?? "unset";
                  const active = ymd === selectedYmd;
                  // 過去日かどうかをチェック（文字列として比較）
                  const todayYmd = formatYmd(new Date());
                  const isPastDate = ymd < todayYmd;
                  const color =
                    status === "open"
                      ? "bg-emerald-50"
                      : status === "holiday" || status === "closed"
                        ? "bg-slate-50"
                        : "bg-white";
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => setSelectedYmd(ymd)}
                      disabled={isPastDate}
                      className={[
                        "min-h-12 px-2 py-2 text-left text-xs",
                        color,
                        inMonth ? "text-slate-800" : "text-slate-400",
                        active ? "ring-2 ring-slate-900/30" : "ring-0",
                        isPastDate ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 focus:outline-none"
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{d.getDate()}</div>
                        {status !== "unset" ? (
                          <div
                            className={[
                              "h-2 w-2 rounded-full",
                              status === "open"
                                ? "bg-emerald-500"
                                : status === "holiday"
                                  ? "bg-slate-400"
                                  : "bg-slate-500"
                            ].join(" ")}
                          />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/70">
              <div className="text-sm font-semibold text-slate-800">選択日：{selectedYmd}</div>
              {(() => {
                // 過去日かどうかをチェック（文字列として比較）
                const todayYmd = formatYmd(new Date());
                const isPastDate = selectedYmd < todayYmd;
                return isPastDate ? (
                  <div className="mt-2 rounded-xl bg-amber-50 px-2 py-1.5 ring-1 ring-amber-200/70">
                    <div className="text-xs text-amber-800">過去日は変更できません</div>
                  </div>
                ) : null;
              })()}
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold text-slate-600">状態</div>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <select
                      value={dayStatus[selectedYmd] ?? "unset"}
                      onChange={(e) =>
                        setDayStatus((prev) => ({ ...prev, [selectedYmd]: e.target.value as DayStatus }))
                      }
                      disabled={(() => {
                        // 過去日は変更不可（文字列として比較）
                        const todayYmd = formatYmd(new Date());
                        return selectedYmd < todayYmd;
                      })()}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="unset">未設定（非表示）</option>
                      <option value="open">営業日（予約可）</option>
                      <option value="holiday">休日（表示/予約不可）</option>
                      <option value="closed">定休日（表示/予約不可）</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    {staffList.length > 0 ? (
                      <>
                        {(() => {
                          // 営業日（status='open'）を選択している店員のみを表示
                          const workingStaffIds = new Set(
                            selectedDayStaffStatus
                              .filter((bd) => bd.status === "open")
                              .map((bd) => bd.staff_id)
                          );
                          const workingStaff = staffList.filter((s) => workingStaffIds.has(s.id));
                          
                          // 操作している店員以外の店員をフィルタリング
                          const otherWorkingStaff = currentStaffId
                            ? workingStaff.filter((s) => s.id !== currentStaffId)
                            : workingStaff;
                          return (
                            <>
                              <div className="rounded-lg bg-emerald-50 px-2 py-1 ring-1 ring-emerald-200/70">
                                <div className="text-xs font-semibold text-emerald-700">出勤Staff</div>
                                <div className="mt-0.5 text-xs text-emerald-600">
                                {otherWorkingStaff.length > 0 ? otherWorkingStaff.map((s) => s.name).join("・") : "---"}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-slate-200/70">
                        <div className="text-xs text-slate-400">読み込み中...</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(dayStatus[selectedYmd] ?? "unset") === "open" ? (
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={(dayHours[selectedYmd] as any)?.enabled === true}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setDayHours((prev: Record<string, DayHoursOverride>) => ({
                          ...prev,
                          [selectedYmd]: enabled
                            ? { enabled: true, openTime, closeTime, lunchOverrideEnabled: false }
                            : { enabled: false }
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    個別営業時間を設定
                  </label>

                  {(dayHours[selectedYmd] as any)?.enabled ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={(dayHours[selectedYmd] as any).openTime}
                          onChange={(e) =>
                            setDayHours((prev: Record<string, DayHoursOverride>) => ({
                              ...prev,
                              [selectedYmd]: {
                                ...(dayHours[selectedYmd] as any),
                                enabled: true,
                                openTime: e.target.value
                              }
                            }))
                          }
                          className="h-9 w-[120px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                        />
                        <span className="text-xs text-slate-500">–</span>
                        <input
                          type="time"
                          value={(dayHours[selectedYmd] as any).closeTime}
                          onChange={(e) =>
                            setDayHours((prev: Record<string, DayHoursOverride>) => ({
                              ...prev,
                              [selectedYmd]: {
                                ...(dayHours[selectedYmd] as any),
                                enabled: true,
                                closeTime: e.target.value
                              }
                            }))
                          }
                          className="h-9 w-[120px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                        />
                      </div>

                      <div className="rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-200/70">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={(dayHours[selectedYmd] as any).lunchOverrideEnabled}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              const cur = (dayHours[selectedYmd] as any) ?? {};
                              setDayHours((prev: Record<string, DayHoursOverride>) => ({
                                ...prev,
                                [selectedYmd]: enabled
                                  ? {
                                      ...cur,
                                      enabled: true,
                                      lunchOverrideEnabled: true,
                                      lunchStart: lunchStart,
                                      lunchEnd: lunchEnd
                                    }
                                  : {
                                      ...cur,
                                      enabled: true,
                                      lunchOverrideEnabled: false,
                                      lunchStart: undefined,
                                      lunchEnd: undefined
                                    }
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                          昼休憩（個別）
                        </label>

                        {(dayHours[selectedYmd] as any).lunchOverrideEnabled ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="time"
                              value={(dayHours[selectedYmd] as any).lunchStart ?? lunchStart}
                              onChange={(e) =>
                                setDayHours((prev: Record<string, DayHoursOverride>) => ({
                                  ...prev,
                                  [selectedYmd]: {
                                    ...(dayHours[selectedYmd] as any),
                                    enabled: true,
                                    lunchOverrideEnabled: true,
                                    lunchStart: e.target.value,
                                    lunchEnd: (dayHours[selectedYmd] as any).lunchEnd ?? lunchEnd
                                  }
                                }))
                              }
                              className="h-8 w-[110px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                            />
                            <span className="text-xs text-slate-500">–</span>
                            <input
                              type="time"
                              value={(dayHours[selectedYmd] as any).lunchEnd ?? lunchEnd}
                              onChange={(e) =>
                                setDayHours((prev: Record<string, DayHoursOverride>) => ({
                                  ...prev,
                                  [selectedYmd]: {
                                    ...(dayHours[selectedYmd] as any),
                                    enabled: true,
                                    lunchOverrideEnabled: true,
                                    lunchStart: (dayHours[selectedYmd] as any).lunchStart ?? lunchStart,
                                    lunchEnd: e.target.value
                                  }
                                }))
                              }
                              className="h-8 w-[110px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                            />
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-500">
                            デフォルト：
                            {lunchEnabled ? `${formatTime(lunchStart)}–${formatTime(lunchEnd)}` : "なし"}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">
                      デフォルト：{formatTime(openTime)}–{formatTime(closeTime)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-400">
                  未設定/営業日以外では営業時間の個別設定は表示しません
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {loading ? (
              <div className="text-sm text-slate-500">読み込み中...</div>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>
      {children}
    </label>
  );
}


