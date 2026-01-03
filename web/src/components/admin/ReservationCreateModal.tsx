"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import type { AdminReservation } from "@/components/admin/reservationTypes";
import { getTreatments } from "@/lib/treatments";
import { searchLineUsers } from "@/lib/reservations";
import { selectFromTable } from "@/lib/admin-db-proxy";
import type { Database } from "@/lib/database.types";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];

export function ReservationCreateModal({
  dateYmd,
  initialTime,
  mode,
  initialReservation,
  onClose,
  onSubmit
}: {
  dateYmd: string;
  initialTime: string;
  mode: "create" | "edit";
  initialReservation?: AdminReservation;
  onClose: () => void;
  onSubmit: (r: AdminReservation, treatmentId: string, lineUserId: string) => void | Promise<void>;
}) {
  const [name, setName] = useState<string>(() => initialReservation?.name ?? "");
  const [lineUserId, setLineUserId] = useState<string>(() => initialReservation?.lineUserId ?? "");
  const [lineDisplayName, setLineDisplayName] = useState<string>(() => initialReservation?.lineDisplayName ?? "");
  const [time, setTime] = useState<string>(() => initialReservation?.time ?? initialTime);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string>(() => {
    // Will be set after treatments load
    return "";
  });
  
  // LINEユーザー検索関連
  const [lineUserSearchQuery, setLineUserSearchQuery] = useState<string>("");
  const [lineUserSearchResults, setLineUserSearchResults] = useState<Array<{
    lineUserId: string;
    name: string;
    lineDisplayName?: string;
    lastReservationDate?: string;
  }>>([]);
  const [showLineUserSearchResults, setShowLineUserSearchResults] = useState(false);
  const [searchingLineUsers, setSearchingLineUsers] = useState(false);
  const [selectedLineUser, setSelectedLineUser] = useState<{
    lineUserId: string;
    name: string;
    lineDisplayName?: string;
  } | null>(null);
  const lineUserSearchRef = useRef<HTMLDivElement>(null);

  // Load treatments
  useEffect(() => {
    async function loadTreatments() {
      try {
        setLoadingTreatments(true);
        const data = await getTreatments();
        setTreatments(data);
        if (data.length > 0) {
          // Set initial menu ID
          if (initialReservation?.menu) {
            const found = data.find((t) => t.name === initialReservation.menu);
            if (found) {
              setMenuId(found.id);
            } else {
              setMenuId(data[0].id);
            }
          } else {
            setMenuId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load treatments:", err);
      } finally {
        setLoadingTreatments(false);
      }
    }

    loadTreatments();
  }, [initialReservation?.menu]);

  const selectedMenu = useMemo(
    () => treatments.find((t) => t.id === menuId),
    [treatments, menuId]
  );

  // Debug: Log state changes
  useEffect(() => {
    console.log("[ReservationCreateModal] State update:", {
      name: name.trim(),
      lineUserId: lineUserId.trim(),
      menuId,
      selectedMenu: !!selectedMenu,
      treatmentsCount: treatments.length,
      loadingTreatments,
      saving,
      disabled: saving || !selectedMenu || loadingTreatments || !name.trim() || !lineUserId.trim()
    });
  }, [name, lineUserId, menuId, selectedMenu, treatments.length, loadingTreatments, saving]);

  // LINEユーザー検索
  useEffect(() => {
    if (lineUserSearchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(async () => {
        setSearchingLineUsers(true);
        try {
          const results = await searchLineUsers(lineUserSearchQuery);
          setLineUserSearchResults(results);
          setShowLineUserSearchResults(results.length > 0);
        } catch (err) {
          console.error("Failed to search LINE users:", err);
          setLineUserSearchResults([]);
          setShowLineUserSearchResults(false);
        } finally {
          setSearchingLineUsers(false);
        }
      }, 300); // デバウンス

      return () => clearTimeout(timeoutId);
    } else {
      setLineUserSearchResults([]);
      setShowLineUserSearchResults(false);
    }
  }, [lineUserSearchQuery]);

  // クリックアウトサイドで検索結果を閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lineUserSearchRef.current && !lineUserSearchRef.current.contains(event.target as Node)) {
        setShowLineUserSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear error when user edits inputs
  useEffect(() => setSubmitError(null), [name, lineUserId, lineDisplayName, time, menuId]);

  return (
    <Modal
      title={mode === "create" ? "予約作成" : "予約変更"}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      disableEscape={saving}
      footer={
        <div className="space-y-2">
          {submitError ? (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200/70">
              {submitError}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (saving) return;
              onClose();
            }}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={async () => {
              console.log("[ReservationCreateModal] Save button clicked", {
                saving,
                name: name.trim(),
                lineUserId: lineUserId.trim(),
                selectedMenu: !!selectedMenu,
                loadingTreatments
              });

              if (saving) {
                console.log("[ReservationCreateModal] Already saving, returning");
                return;
              }
              setSubmitError(null);

              if (!name.trim()) {
                console.log("[ReservationCreateModal] Name validation failed");
                setSubmitError("お名前を入力してください。");
                return;
              }
              if (!lineUserId.trim()) {
                console.log("[ReservationCreateModal] LINE User ID validation failed");
                setSubmitError("LINEユーザーIDを入力してください。");
                return;
              }
              if (!selectedMenu) {
                console.log("[ReservationCreateModal] Menu validation failed");
                setSubmitError("施術内容（メニュー）を選択してください。");
                return;
              }

              const r: AdminReservation = {
                id: initialReservation?.id ?? crypto.randomUUID(),
                dateYmd,
                time,
                name: name.trim(),
                lineUserId: lineUserId.trim(),
                lineDisplayName: lineDisplayName.trim() || undefined,
                menu: selectedMenu.name,
                durationMinutes: selectedMenu.duration_minutes,
                priceYen: selectedMenu.price_yen,
                via: initialReservation?.via ?? "phone"
              };
              
              console.log("[ReservationCreateModal] Calling onSubmit", r);
              try {
                setSaving(true);
                await onSubmit(r, selectedMenu.id, lineUserId.trim());
                console.log("[ReservationCreateModal] onSubmit completed successfully");
              } catch (err) {
                console.error("[ReservationCreateModal] onSubmit error:", err);
                setSubmitError(err instanceof Error ? err.message : "保存に失敗しました");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !selectedMenu || loadingTreatments || !name.trim() || !lineUserId.trim()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              saving
                ? "保存中..."
                : loadingTreatments
                ? "読み込み中..."
                : !selectedMenu
                ? "施術内容を選択してください"
                : !name.trim()
                ? "お名前を入力してください"
                : !lineUserId.trim()
                ? "LINEユーザーIDを入力してください"
                : "保存"
            }
          >
            {saving ? "保存中..." : loadingTreatments ? "読み込み中..." : "保存"}
          </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="日付">
          <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-700">
            {dateYmd}
          </div>
        </Field>
        <Field label="時間">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          />
        </Field>
        <Field label="予約するお客様を検索" className="sm:col-span-2">
          <div ref={lineUserSearchRef} className="relative">
            <input
              value={lineUserSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setLineUserSearchQuery(value);
                if (value.length >= 2) {
                  setShowLineUserSearchResults(true);
                } else {
                  setShowLineUserSearchResults(false);
                  setSelectedLineUser(null);
                  setLineUserId("");
                  setName("");
                  setLineDisplayName("");
                }
              }}
              onFocus={() => {
                if (lineUserSearchResults.length > 0) {
                  setShowLineUserSearchResults(true);
                }
              }}
              placeholder="お客様のお名前・LINE表示名で検索（2文字以上）"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            />
            {lineUserSearchQuery.length >= 2 && (
              <div className="mt-1 text-xs text-slate-500">
                2文字以上入力すると、お客様を特定または選択できます
              </div>
            )}
            {searchingLineUsers && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                検索中...
              </div>
            )}
            {showLineUserSearchResults && lineUserSearchResults.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {lineUserSearchResults.map((user) => (
                  <button
                    key={user.lineUserId}
                    type="button"
                    onClick={() => {
                      setLineUserId(user.lineUserId);
                      setLineUserSearchQuery("");
                      setName(user.name);
                      if (user.lineDisplayName) {
                        setLineDisplayName(user.lineDisplayName);
                      }
                      setSelectedLineUser(user);
                      setShowLineUserSearchResults(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="font-medium text-slate-900">{user.name}</div>
                    {user.lineDisplayName && (
                      <div className="text-xs text-slate-500">LINE: {user.lineDisplayName}</div>
                    )}
                    <div className="text-xs text-slate-400 font-mono truncate">
                      {user.lineUserId}
                    </div>
                    {user.lastReservationDate && (
                      <div className="text-xs text-slate-400">
                        最終予約: {user.lastReservationDate}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="お名前">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly
            disabled
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 shadow-sm cursor-not-allowed"
          />
        </Field>
        <Field label="LINE表示名">
          <input
            value={lineDisplayName}
            onChange={(e) => setLineDisplayName(e.target.value)}
            readOnly
            disabled
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 shadow-sm cursor-not-allowed"
          />
        </Field>
        <Field label="LINEユーザーID" className="sm:col-span-2">
          <input
            value={selectedLineUser ? `${selectedLineUser.name}${selectedLineUser.lineDisplayName ? ` (LINE: ${selectedLineUser.lineDisplayName})` : ""} - ${selectedLineUser.lineUserId}` : lineUserId}
            readOnly
            disabled
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 shadow-sm cursor-not-allowed"
          />
        </Field>
        <Field label="施術内容（メニュー）">
          {loadingTreatments ? (
            <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-500">
              読み込み中...
            </div>
          ) : treatments.length === 0 ? (
            <div className="h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium leading-10 text-red-700">
              施術メニューが登録されていません
            </div>
          ) : (
            <select
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            >
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.duration_minutes}分 / ¥{t.price_yen.toLocaleString("ja-JP")}）
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="施術時間 / 価格">
          <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium leading-10 text-slate-700">
            {selectedMenu
              ? `${selectedMenu.duration_minutes}分 / ¥${selectedMenu.price_yen.toLocaleString("ja-JP")}`
              : "—"}
          </div>
        </Field>
      </div>

    </Modal>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ""}`}>
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>
      {children}
    </label>
  );
}


