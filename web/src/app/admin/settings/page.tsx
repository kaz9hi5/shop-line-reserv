"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import {
  getAppSettings,
  updateAppSettings,
  getBusinessDaysForWeek,
  upsertBusinessDay,
  deleteBusinessDay,
  getBusinessHoursOverrides,
  upsertBusinessHoursOverride,
  deleteBusinessHoursOverride
} from "@/lib/settings";

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

  const weekStart = useMemo(() => startOfWeekMonday(currentDate), [currentDate]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekHours, setWeekHours] = useState<Record<string, DayHoursOverride>>({});

  // Load settings
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setLoading(true);

        // Load app settings
        const settings = await getAppSettings();
        if (!cancelled) {
          setOpenTime(settings.default_open_time);
          setCloseTime(settings.default_close_time);
          setDeadlineHours(settings.reservation_deadline_hours);
          setLunchEnabled(settings.default_lunch_enabled);
          setLunchStart(settings.default_lunch_start || "12:00");
          setLunchEnd(settings.default_lunch_end || "13:00");
        }

        // Load business days for week
        const businessDays = await getBusinessDaysForWeek(weekStart);
        if (!cancelled) {
          const statusMap: Record<string, DayStatus> = {};
          for (const d of week) {
            const ymd = formatYmd(d);
            const dayData = businessDays.find((bd) => bd.day === ymd);
            statusMap[ymd] = dayData ? (dayData.status as DayStatus) : "unset";
          }
          setWeekStatus(statusMap);
        }

        // Load business hours overrides for week
        const weekEnd = addDays(weekStart, 6);
        const overrides = await getBusinessHoursOverrides(weekStart, weekEnd);
        if (!cancelled) {
          const hoursMap: Record<string, DayHoursOverride> = {};
          for (const d of week) {
            const ymd = formatYmd(d);
            const override = overrides.find((o) => o.day === ymd);
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
          setWeekHours(hoursMap);
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
  }, [weekStart, week]);

  const unsetCount = useMemo(
    () => week.filter((d) => (weekStatus[formatYmd(d)] ?? "unset") === "unset").length,
    [week, weekStatus]
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      setFlash(null);

      // Save app settings
      await updateAppSettings({
        default_open_time: openTime,
        default_close_time: closeTime,
        reservation_deadline_hours: deadlineHours,
        default_lunch_enabled: lunchEnabled,
        default_lunch_start: lunchEnabled ? lunchStart : null,
        default_lunch_end: lunchEnabled ? lunchEnd : null
      });

      // Save business days
      for (const d of week) {
        const ymd = formatYmd(d);
        const status = weekStatus[ymd] || "unset";
        if (status === "unset") {
          await deleteBusinessDay(ymd);
        } else {
          await upsertBusinessDay(ymd, status);
        }
      }

      // Save business hours overrides
      for (const d of week) {
        const ymd = formatYmd(d);
        const hours = weekHours[ymd];
        if (!hours || !hours.enabled) {
          await deleteBusinessHoursOverride(ymd);
        } else {
          await upsertBusinessHoursOverride({
            day: ymd,
            open_time: hours.openTime,
            close_time: hours.closeTime,
            lunch_enabled: hours.lunchOverrideEnabled,
            lunch_start: hours.lunchOverrideEnabled ? hours.lunchStart || null : null,
            lunch_end: hours.lunchOverrideEnabled ? hours.lunchEnd || null : null
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

  return (
    <div className="space-y-4">
      {flash ? (
        <div className="sticky top-3 z-40">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10">
              <div className="min-w-0 truncate">{flash}</div>
              <button
                type="button"
                onClick={() => setFlash(null)}
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
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                />
              </Field>
              <Field label="終了">
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                />
              </Field>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">昼休憩（デフォルト）</div>
                  <div className="text-xs text-slate-500">任意（ON の場合は昼休憩時間を予約不可にします）</div>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={lunchEnabled}
                    onChange={(e) => setLunchEnabled(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-slate-900"
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
                      className="h-9 w-[120px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                    />
                    <span className="text-xs text-slate-500">–</span>
                    <input
                      type="time"
                      value={lunchEnd}
                      onChange={(e) => setLunchEnd(e.target.value)}
                      className="h-9 w-[120px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
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
                className="w-full"
              />
              <div className="w-20 text-right text-sm font-semibold text-slate-800">
                {deadlineHours}h
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              期限日時の計算/表示は、予約画面側で予約日時から差し引いて表示します。
            </p>
          </Card>
        </div>

        <Card title="営業日（週：月曜から日曜）" right={`${formatYmd(weekStart)}〜`}>
          <p className="text-sm leading-6 text-slate-600">
            営業日設定は <span className="font-semibold">日付単位</span>で行います。予約画面は
            「月曜〜日曜の一週間のうち、状態が設定された日付」だけ表示します。
          </p>

          {unsetCount > 0 ? (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200/70">
              <p className="text-xs leading-5 text-amber-900">
                この週に未設定の日付が {unsetCount} 件あります（予約画面には表示されません）。
              </p>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
            <div className="grid grid-cols-[1fr_140px_320px] bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
              <div>日付</div>
              <div>状態</div>
              <div>営業時間（個別）</div>
            </div>
            <ul className="divide-y divide-slate-200/70 bg-white">
              {week.map((d) => {
                const key = formatYmd(d);
                const value = weekStatus[key] ?? "unset";
                const hours: DayHoursOverride = weekHours[key] ?? { enabled: false };
                const showHoursControls = value !== "unset";
                return (
                  <li
                    key={key}
                    className="grid grid-cols-[1fr_140px_320px] items-center gap-3 px-3 py-3"
                  >
                    <div className="text-sm font-medium text-slate-700">{formatLabel(d)}</div>
                    <select
                      value={value}
                      onChange={(e) =>
                        setWeekStatus((prev) => ({ ...prev, [key]: e.target.value as DayStatus }))
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                    >
                      <option value="unset">未設定（非表示）</option>
                      <option value="open">営業日（予約可）</option>
                      <option value="holiday">休日（表示/予約不可）</option>
                      <option value="closed">定休日（表示/予約不可）</option>
                    </select>

                    <div className="min-w-0">
                      {showHoursControls ? (
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={hours.enabled}
                              onChange={(e) => {
                                const enabled = e.target.checked;
                                setWeekHours((prev: Record<string, DayHoursOverride>) => ({
                                  ...prev,
                                  [key]: enabled
                                    ? { enabled: true, openTime, closeTime, lunchOverrideEnabled: false }
                                    : { enabled: false }
                                }));
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900"
                            />
                            個別
                          </label>

                          {hours.enabled ? (
                            <div className="flex min-w-0 flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={hours.openTime}
                                  onChange={(e) =>
                                    setWeekHours((prev: Record<string, DayHoursOverride>) => ({
                                      ...prev,
                                      [key]: {
                                        ...hours,
                                        enabled: true,
                                        openTime: e.target.value
                                      }
                                    }))
                                  }
                                  className="h-9 w-[100px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                />
                                <span className="text-xs text-slate-500">–</span>
                                <input
                                  type="time"
                                  value={hours.closeTime}
                                  onChange={(e) =>
                                    setWeekHours((prev: Record<string, DayHoursOverride>) => ({
                                      ...prev,
                                      [key]: {
                                        ...hours,
                                        enabled: true,
                                        closeTime: e.target.value
                                      }
                                    }))
                                  }
                                  className="h-9 w-[100px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                />
                              </div>

                              <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-200/70">
                                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={hours.lunchOverrideEnabled}
                                    onChange={(e) => {
                                      const enabled = e.target.checked;
                                      setWeekHours((prev: Record<string, DayHoursOverride>) => ({
                                        ...prev,
                                        [key]: enabled
                                          ? {
                                              ...hours,
                                              enabled: true,
                                              lunchOverrideEnabled: true,
                                              lunchStart: lunchStart,
                                              lunchEnd: lunchEnd
                                            }
                                          : {
                                              ...hours,
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

                                {hours.lunchOverrideEnabled ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="time"
                                      value={hours.lunchStart ?? lunchStart}
                                      onChange={(e) =>
                                        setWeekHours((prev: Record<string, DayHoursOverride>) => ({
                                          ...prev,
                                          [key]: {
                                            ...hours,
                                            enabled: true,
                                            lunchOverrideEnabled: true,
                                            lunchStart: e.target.value,
                                            lunchEnd: hours.lunchEnd ?? lunchEnd
                                          }
                                        }))
                                      }
                                      className="h-8 w-[95px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                    />
                                    <span className="text-xs text-slate-500">–</span>
                                    <input
                                      type="time"
                                      value={hours.lunchEnd ?? lunchEnd}
                                      onChange={(e) =>
                                        setWeekHours((prev: Record<string, DayHoursOverride>) => ({
                                          ...prev,
                                          [key]: {
                                            ...hours,
                                            enabled: true,
                                            lunchOverrideEnabled: true,
                                            lunchStart: hours.lunchStart ?? lunchStart,
                                            lunchEnd: e.target.value
                                          }
                                        }))
                                      }
                                      className="h-8 w-[95px] rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                    />
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500">
                                    デフォルト：
                                    {lunchEnabled ? `${lunchStart}–${lunchEnd}` : "なし"}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">
                              デフォルト：{openTime}–{closeTime}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">未設定は非表示</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
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


