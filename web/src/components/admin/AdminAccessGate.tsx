"use client";

import { useAdminAccess } from "@/components/admin/AdminAccessContext";
import { Card } from "@/components/ui/Card";
import { generateDeviceFingerprint } from "@/lib/device-fingerprint";
import { gateAddAllowedIp } from "@/lib/staff";
import { useEffect, useMemo, useState } from "react";

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const { currentIp, isLoading, ipDetectionError, isAllowed, retryIpDetection, lastIpDetectedAtMs } = useAdminAccess();
  const [managerName, setManagerName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const secondsUntilNextRefresh = useMemo(() => {
    // AdminAccessContext refreshes IP every 10 seconds.
    if (!lastIpDetectedAtMs) return 10;
    const elapsedSec = Math.floor((nowMs - lastIpDetectedAtMs) / 1000);
    const remain = 10 - (elapsedSec % 10);
    return Math.max(0, Math.min(10, remain));
  }, [lastIpDetectedAtMs, nowMs]);

  // IPアドレス取得中または許可判定中
  if (isLoading) {
    return (
      <Card title="IPアドレス取得中">
        <p className="text-sm leading-6 text-slate-700">
          現在のIPアドレスを取得しています...
        </p>
      </Card>
    );
  }

  // IPアドレス取得エラー
  if (ipDetectionError) {
    return (
      <Card title="IPアドレス取得エラー">
        <p className="text-sm leading-6 text-slate-700">
          IPアドレスの取得に失敗しました。
        </p>
        <p className="mt-2 text-sm text-red-600">{ipDetectionError}</p>
        <div className="mt-4">
          <button
            type="button"
            onClick={retryIpDetection}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            再試行
          </button>
        </div>
      </Card>
    );
  }

  // IPアドレスが未設定
  if (!currentIp) {
    return (
      <Card title="IPアドレス未検出">
        <p className="text-sm leading-6 text-slate-700">
          IPアドレスを検出できませんでした。手動でIPアドレスを設定するか、再試行してください。
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={retryIpDetection}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            再試行
          </button>
        </div>
      </Card>
    );
  }

  // IPアドレスが許可されていない（明示的にfalseの場合のみ403を表示）
  // isAllowedがtrueの場合のみchildrenを表示
  if (isAllowed !== true) {
    return (
      <Card title="403（アクセス拒否）">
        <p className="text-sm leading-6 text-slate-700">
          この IP（<span className="font-semibold">{currentIp}</span>）は許可リストに存在しないため、管理画面へアクセスできません。（IPの再取得まで{secondsUntilNextRefresh}秒）
        </p>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-xs font-semibold text-slate-600">店員のお一人である事を確認します。店長名を入力してボタンを押してください。</div>
          <div className="mt-2 flex gap-2">
            <input
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="例: 店長"
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const input = managerName.trim();
                  if (!input) {
                    alert("入力してからボタン押してください。");
                    return;
                  }
                  setVerifying(true);
                  const ok = await gateAddAllowedIp({
                    ip: currentIp,
                    managerName: input,
                    deviceFingerprint: generateDeviceFingerprint()
                  });
                  if (!ok) {
                    alert("店長名が一致しません。IPの追加はできません。");
                    return;
                  }
                  // Refresh the page state by re-detecting IP; context will re-check allowlist.
                  await retryIpDetection();
                } catch (err) {
                  console.error("Failed to add allowed IP:", err);
                  alert(`IPアドレスの追加に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
                } finally {
                  setVerifying(false);
                }
              }}
              disabled={verifying}
              className={[
                "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800",
                verifying ? "opacity-60 cursor-not-allowed" : ""
              ].join(" ")}
            >
              {verifying ? "確認中..." : "このIPを許可リストに追加"}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}
