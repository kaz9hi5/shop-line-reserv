"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { callRpc } from "@/lib/admin-db-proxy";
import { isIpAllowed } from "@/lib/access-logs";
import { generateDeviceFingerprint } from "@/lib/device-fingerprint";
import { getClientIp } from "@/lib/ip-detection";

type AdminAccessState = {
  currentIp: string;
  isAllowed: boolean;
  isLoading: boolean;
  ipDetectionError: string | null;
  lastIpDetectedAtMs: number | null;
  setCurrentIp: (ip: string) => void;
  retryIpDetection: () => void;
};

const AdminAccessContext = createContext<AdminAccessState | null>(null);

function normalizeIp(ip: string) {
  return ip.trim();
}

function isValidIpLoose(ip: string) {
  // モック用：厳密バリデーションは後で。現状は空以外を許容。
  return normalizeIp(ip).length > 0;
}

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const [currentIp, setCurrentIpState] = useState<string>("");
  const [isAllowedState, setIsAllowedState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAllowed, setIsCheckingAllowed] = useState(false);
  const [ipDetectionError, setIpDetectionError] = useState<string | null>(null);
  const [lastIpDetectedAtMs, setLastIpDetectedAtMs] = useState<number | null>(null);
  const lastTouchedIpRef = useRef<string | null>(null);
  const ipRefreshInFlightRef = useRef(false);

  // Auto-detect IP address on mount
  useEffect(() => {
    async function detectIp() {
      try {
        setIsLoading(true);
        setIpDetectionError(null);
        const ip = await getClientIp();
        setCurrentIpState(normalizeIp(ip));
        setLastIpDetectedAtMs(Date.now());
      } catch (err) {
        console.error("Failed to detect IP:", err);
        setIpDetectionError(err instanceof Error ? err.message : "IPアドレスの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }

    detectIp();
  }, []);

  // Auto-refresh IP address every 10 seconds (silent: do not toggle isLoading)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (ipRefreshInFlightRef.current) return;
      ipRefreshInFlightRef.current = true;
      try {
        const ip = await getClientIp();
        const next = normalizeIp(ip);
        if (!cancelled) setLastIpDetectedAtMs(Date.now());
        if (!cancelled && next && next !== currentIp) {
          setCurrentIpState(next);
          setIpDetectionError(null);
        }
      } catch (err) {
        // Don't spam UI with periodic errors.
        // Only surface error if we don't have a valid current IP yet.
        if (!cancelled && !currentIp) {
          setIpDetectionError(err instanceof Error ? err.message : "IPアドレスの取得に失敗しました");
        }
      } finally {
        ipRefreshInFlightRef.current = false;
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, 10_000);

    // Run once soon after mount as well (without showing loading)
    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentIp]);

  // Check if IP is allowed - allowedIps の変更も監視
  useEffect(() => {
    async function checkIp() {
      const ip = normalizeIp(currentIp);
      if (!ip) {
        setIsAllowedState(false);
        setIsCheckingAllowed(false);
        return;
      }

      try {
        setIsCheckingAllowed(true);
        const allowed = await isIpAllowed(ip);
        setIsAllowedState(allowed);
      } catch (err) {
        console.error("Failed to check IP:", err);
        setIsAllowedState(false);
      } finally {
        setIsCheckingAllowed(false);
      }
    }

    if (currentIp && !isLoading) {
      checkIp();
    } else if (!currentIp && !isLoading) {
      setIsCheckingAllowed(false);
    }
  }, [currentIp, isLoading]);

  // When admin access is allowed, refresh device_fingerprint for this allowlisted IP.
  // (Once per mount + per IP change)
  useEffect(() => {
    const ip = normalizeIp(currentIp);
    if (!ip || isLoading || !isAllowedState) return;
    if (lastTouchedIpRef.current === ip) return;
    lastTouchedIpRef.current = ip;
    (async () => {
      try {
        await callRpc("touch_admin_allowed_ip_fingerprint", {
          p_ip: ip,
          p_device_fingerprint: generateDeviceFingerprint()
        });
      } catch (err) {
        // Don't block UI on telemetry-like update
        console.error("Failed to touch device fingerprint:", err);
      }
    })();
  }, [currentIp, isAllowedState, isLoading]);

  const retryIpDetection = async () => {
    try {
      setIsLoading(true);
      setIpDetectionError(null);
      const ip = await getClientIp();
      setCurrentIpState(normalizeIp(ip));
      setLastIpDetectedAtMs(Date.now());
    } catch (err) {
      console.error("Failed to detect IP:", err);
      setIpDetectionError(err instanceof Error ? err.message : "IPアドレスの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo<AdminAccessState>(
    () => ({
      currentIp,
      isAllowed: isAllowedState,
      isLoading: isLoading || isCheckingAllowed,
      ipDetectionError,
      lastIpDetectedAtMs,
      setCurrentIp: (ip) => setCurrentIpState(normalizeIp(ip)),
      retryIpDetection
    }),
    [currentIp, isAllowedState, isLoading, isCheckingAllowed, ipDetectionError, lastIpDetectedAtMs]
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error("useAdminAccess must be used within AdminAccessProvider");
  return ctx;
}
