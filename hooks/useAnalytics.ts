"use client";

import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Activity payload for internal user tracking — all data shown in Admin Center > Activity Tracker */
export interface ActivityPayload {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PageViewData {
  pagePath?: string;
  pageTitle?: string;
  referrer?: string;
  queryParams?: Record<string, string>;
}

export interface FieldChangeData {
  entityType: string;
  entityId: string | number;
  entityLabel?: string;
  fieldName: string;
  fieldLabel?: string;
  oldValue: string;
  newValue: string;
  changeType?: "create" | "update" | "delete";
  changeReason?: string;
}

const ACTIVITY_DEBOUNCE_MS = 800;
const HEARTBEAT_INTERVAL_MS = 30000;
const ENGAGEMENT_INTERVAL_MS = 30000;

/** Log a single activity to the backend (Activity Tracker). Credentials sent via cookies. */
async function logActivityToBackend(payload: ActivityPayload): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: payload.action,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId != null ? String(payload.entityId) : null,
        entityLabel: payload.entityLabel ?? null,
        metadata: payload.metadata ?? null,
      }),
      keepalive: true,
    });
  } catch {
    // Silent fail for activity logging
  }
}

export function useAnalytics() {
  const [isTracking, setIsTracking] = useState(false);
  const pageStartTime = useRef<number>(Date.now());
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickCount = useRef(0);
  const formFillCount = useRef(0);
  const maxScrollDepth = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logActivity = useCallback((payload: ActivityPayload) => {
    lastActivityRef.current = Date.now();
    logActivityToBackend(payload);
  }, []);

  // Start tracking session (internal user only — used inside dashboard)
  const startSession = useCallback(async () => {
    if (typeof window === "undefined" || isTracking) return;
    try {
      const screenResolution = `${window.screen.width}x${window.screen.height}`;
      logActivity({
        action: "session_start",
        entityType: "session",
        metadata: {
          screenResolution,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href,
          pathname: window.location.pathname,
        },
      });
      setIsTracking(true);

      heartbeatInterval.current = setInterval(() => {
        logActivity({
          action: "heartbeat",
          entityType: "session",
          metadata: {
            pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
          },
        });
      }, HEARTBEAT_INTERVAL_MS);
    } catch (e) {
      console.error("Failed to start activity session:", e);
    }
  }, [isTracking, logActivity]);

  const endSession = useCallback(async () => {
    if (typeof window === "undefined" || !isTracking) return;
    try {
      logActivity({
        action: "session_end",
        entityType: "session",
        metadata: { pathname: window.location.pathname },
      });
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      setIsTracking(false);
    } catch (e) {
      console.error("Failed to end activity session:", e);
    }
  }, [isTracking, logActivity]);

  const trackPageView = useCallback(
    async (data: PageViewData = {}) => {
      if (typeof window === "undefined") return;
      const path = data.pagePath ?? window.location.pathname;
      const title = data.pageTitle ?? document.title;
      const referrer = (data.referrer ?? document.referrer) || undefined;
      const urlParams = new URLSearchParams(window.location.search);
      const queryParams: Record<string, string> = {};
      urlParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      pageStartTime.current = Date.now();

      logActivity({
        action: "page_view",
        entityType: "page",
        entityId: path,
        entityLabel: title,
        metadata: {
          path,
          title,
          referrer: referrer || undefined,
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
      });
    },
    [logActivity]
  );

  const trackFieldChange = useCallback(
    async (data: FieldChangeData) => {
      if (typeof window === "undefined") return;
      logActivity({
        action: "field_change",
        entityType: data.entityType,
        entityId: String(data.entityId),
        entityLabel: data.entityLabel ?? undefined,
        metadata: {
          fieldName: data.fieldName,
          fieldLabel: data.fieldLabel,
          oldValue: data.oldValue,
          newValue: data.newValue,
          changeType: data.changeType,
          changeReason: data.changeReason,
        },
      });
    },
    [logActivity]
  );

  const trackClick = useCallback(
    async (elementInfo?: { tagName?: string; id?: string; text?: string; href?: string }) => {
      if (typeof window === "undefined") return;
      clickCount.current += 1;
      logActivity({
        action: "click",
        entityType: "interaction",
        metadata: {
          clickCount: clickCount.current,
          ...elementInfo,
        },
      });
    },
    [logActivity]
  );

  const updateEngagement = useCallback(() => {
    if (typeof window === "undefined") return;
    const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000);
    logActivity({
      action: "engagement",
      entityType: "page",
      entityId: window.location.pathname,
      entityLabel: document.title,
      metadata: {
        timeOnPageSeconds: timeOnPage,
        scrollDepthPercent: maxScrollDepth.current,
        clickCount: clickCount.current,
        formFills: formFillCount.current,
      },
    });
  }, [logActivity]);

  const trackFormFill = useCallback(() => {
    formFillCount.current += 1;
  }, []);

  return {
    isTracking,
    startSession,
    endSession,
    trackPageView,
    trackFieldChange,
    trackClick,
    trackFormFill,
    updateEngagement,
    logActivity,
    maxScrollDepth,
    pageStartTime,
    formFillCount,
    clickCount,
  };
}

/** Wrapper that enables automatic activity tracking for the current (internal) user. Use only inside dashboard. */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    startSession,
    endSession,
    trackPageView,
    trackClick,
    trackFormFill,
    updateEngagement,
    maxScrollDepth,
  } = useAnalytics();
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formFillDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    startSession();
    trackPageView({});
    prevPathnameRef.current = pathname ?? window.location.pathname;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;
      if (scrollPercent > maxScrollDepth.current) {
        maxScrollDepth.current = scrollPercent;
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(updateEngagement, 1000);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName?.toLowerCase();
      const id = target.id || undefined;
      const text = target.textContent?.slice(0, 80) || undefined;
      const href = (target as HTMLAnchorElement).href || undefined;
      trackClick({ tagName, id, text, href });
    };

    const handleFormActivity = () => {
      trackFormFill();
      if (formFillDebounceRef.current) clearTimeout(formFillDebounceRef.current);
      formFillDebounceRef.current = setTimeout(updateEngagement, ACTIVITY_DEBOUNCE_MS);
    };

    const handleBeforeUnload = () => {
      updateEngagement();
      endSession();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("click", handleClick, true);
    window.addEventListener("input", handleFormActivity, true);
    window.addEventListener("change", handleFormActivity, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const engagementInterval = setInterval(updateEngagement, ENGAGEMENT_INTERVAL_MS);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("input", handleFormActivity, true);
      window.removeEventListener("change", handleFormActivity, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(engagementInterval);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (formFillDebounceRef.current) clearTimeout(formFillDebounceRef.current);
      updateEngagement();
      endSession();
    };
  }, [startSession, endSession, trackPageView, trackClick, trackFormFill, updateEngagement, maxScrollDepth]);

  // Track page view on client-side route change (Next.js app router)
  useEffect(() => {
    const current = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    if (!current) return;
    if (prevPathnameRef.current !== null && prevPathnameRef.current !== current) {
      trackPageView({});
    }
    prevPathnameRef.current = current;
  }, [pathname, trackPageView]);

  return children;
}
