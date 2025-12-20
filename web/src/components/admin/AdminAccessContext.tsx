"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Persisted;
      setCurrentIpState(parsed.currentIp ?? "");
      setAllowedIpsState(Array.isArray(parsed.allowedIps) ? parsed.allowedIps : []);
      setAccessLogEnabledState(typeof parsed.accessLogEnabled === "boolean" ? parsed.accessLogEnabled : true);
      setLogs(Array.isArray(parsed.logs) ? parsed.logs : []);
    } catch {
      // ignore
    }
  }, []);

  // persist
  useEffect(() => {
    const payload: Persisted = { currentIp, allowedIps, accessLogEnabled, logs };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [currentIp, allowedIps, accessLogEnabled, logs]);

  const isAllowed = useMemo(() => {
    const ip = normalizeIp(currentIp);
    if (!ip) return false;
    return allowedIps.includes(ip);
  }, [allowedIps, currentIp]);

  // log on route/ip/result changes (dedupe)
  const lastLoggedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!accessLogEnabled) return;
    const ip = normalizeIp(currentIp);
    if (!ip) return;
    const result: AccessLogItem["result"] = allowedIps.includes(ip) ? "allowed" : "denied";
    const key = `${ip}|${pathname}|${result}`;
    if (lastLoggedKeyRef.current === key) return;
    lastLoggedKeyRef.current = key;

    setLogs((prev) => [
      {
        id: crypto.randomUUID(),
        at: nowLabel(),
        ip,
        result,
        path: pathname
      },
      ...prev
    ]);
  }, [accessLogEnabled, allowedIps, currentIp, pathname]);

  const value = useMemo<AdminAccessState>(
    () => ({
      currentIp,
      allowedIps,
      accessLogEnabled,
      logs,
      isAllowed,
      setCurrentIp: (ip) => setCurrentIpState(normalizeIp(ip)),
      addAllowedIp: (ip) => {
        const v = normalizeIp(ip);
        if (!isValidIpLoose(v)) return;
        setAllowedIpsState((prev) => (prev.includes(v) ? prev : [...prev, v]));
      },
      removeAllowedIp: (ip) => {
        const v = normalizeIp(ip);
        setAllowedIpsState((prev) => prev.filter((x) => x !== v));
      },
      setAccessLogEnabled: (enabled) => setAccessLogEnabledState(enabled),
      clearLogs: () => setLogs([])
    }),
    [accessLogEnabled, allowedIps, currentIp, isAllowed, logs]
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error("useAdminAccess must be used within AdminAccessProvider");
  return ctx;
}


