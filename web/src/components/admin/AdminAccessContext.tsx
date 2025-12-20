"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getAllowedIps, isIpAllowed, logAdminAccess, isAccessLogEnabled } from "@/lib/access-logs";

export type AccessLogItem = {
  id: string;
  at: string; // YYYY-MM-DD HH:mm
  ip: string;
  result: "allowed" | "denied";
  path: string;
};

type AdminAccessState = {
  currentIp: string;
  allowedIps: string[];
  accessLogEnabled: boolean;
  logs: AccessLogItem[];
  isAllowed: boolean;
  setCurrentIp: (ip: string) => void;
  addAllowedIp: (ip: string) => void;
  removeAllowedIp: (ip: string) => void;
  setAccessLogEnabled: (enabled: boolean) => void;
  clearLogs: () => void;
};

const AdminAccessContext = createContext<AdminAccessState | null>(null);

const LS_KEY = "shopSmsReserv.adminAccess.v1";

type Persisted = {
  currentIp: string;
  allowedIps: string[];
  accessLogEnabled: boolean;
  logs: AccessLogItem[];
};

function nowLabel() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function normalizeIp(ip: string) {
  return ip.trim();
}

function isValidIpLoose(ip: string) {
  // モック用：厳密バリデーションは後で。現状は空以外を許容。
  return normalizeIp(ip).length > 0;
}

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [currentIp, setCurrentIpState] = useState<string>("");
  const [allowedIps, setAllowedIpsState] = useState<string[]>([]);
  const [accessLogEnabled, setAccessLogEnabledState] = useState<boolean>(true);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAllowedState, setIsAllowedState] = useState<boolean>(false);

  // Load allowed IPs and access log setting
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [ips, enabled] = await Promise.all([
          getAllowedIps(),
          isAccessLogEnabled()
        ]);
        setAllowedIpsState(ips.map((ip) => ip.ip));
        setAccessLogEnabledState(enabled);
      } catch (err) {
        console.error("Failed to load admin access data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Check if IP is allowed
  useEffect(() => {
    async function checkIp() {
      const ip = normalizeIp(currentIp);
      if (!ip) {
        setIsAllowedState(false);
        return;
      }

      try {
        const allowed = await isIpAllowed(ip);
        setIsAllowedState(allowed);
      } catch (err) {
        console.error("Failed to check IP:", err);
        setIsAllowedState(false);
      }
    }

    if (currentIp && !loading) {
      checkIp();
    }
  }, [currentIp, loading]);

  // Log access attempts
  const lastLoggedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!accessLogEnabled || loading) return;
    const ip = normalizeIp(currentIp);
    if (!ip) return;

    const result: AccessLogItem["result"] = isAllowedState ? "allowed" : "denied";
    const key = `${ip}|${pathname}|${result}`;
    if (lastLoggedKeyRef.current === key) return;
    lastLoggedKeyRef.current = key;

    // Log to DB
    logAdminAccess({
      ip,
      result,
      path: pathname,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null
    }).catch((err) => {
      console.error("Failed to log access:", err);
    });
  }, [accessLogEnabled, isAllowedState, currentIp, pathname, loading]);

  const value = useMemo<AdminAccessState>(
    () => ({
      currentIp,
      allowedIps,
      accessLogEnabled,
      logs,
      isAllowed: isAllowedState,
      setCurrentIp: (ip) => setCurrentIpState(normalizeIp(ip)),
      addAllowedIp: async (ip) => {
        const v = normalizeIp(ip);
        if (!isValidIpLoose(v)) return;
        // Note: Actual IP addition is handled in access-logs page
        // This is just for local state update
        setAllowedIpsState((prev) => (prev.includes(v) ? prev : [...prev, v]));
      },
      removeAllowedIp: (ip) => {
        const v = normalizeIp(ip);
        // Note: Actual IP removal is handled in access-logs page
        setAllowedIpsState((prev) => prev.filter((x) => x !== v));
      },
      setAccessLogEnabled: (enabled) => setAccessLogEnabledState(enabled),
      clearLogs: () => setLogs([])
    }),
    [accessLogEnabled, allowedIps, currentIp, isAllowedState, logs]
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error("useAdminAccess must be used within AdminAccessProvider");
  return ctx;
}


