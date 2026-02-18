"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface PageViewData {
  pagePath?: string;
  pageTitle?: string;
  referrer?: string;
  queryParams?: Record<string, string>;
}

interface FieldChangeData {
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

// Generate or get session ID
const getSessionId = (): string => {
  if (typeof window === "undefined") return "";
  
  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
};

export function useAnalytics() {
  const [isTracking, setIsTracking] = useState(false);
  const currentPageViewId = useRef<number | null>(null);
  const pageStartTime = useRef<number>(Date.now());
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickCount = useRef(0);
  const formFillCount = useRef(0);
  const maxScrollDepth = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start tracking session
  const startSession = useCallback(async () => {
    if (typeof window === "undefined" || isTracking) return;

    try {
      const sessionId = getSessionId();
      const screenResolution = `${window.screen.width}x${window.screen.height}`;

      await fetch("/api/analytics/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "start",
          screenResolution,
        }),
      });

      setIsTracking(true);

      // Set up heartbeat to keep session alive
      heartbeatInterval.current = setInterval(async () => {
        try {
          const sid = sessionStorage.getItem("analytics_session_id");
          if (sid) {
            await fetch("/api/analytics/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sid,
                action: "heartbeat",
              }),
            });
          }
        } catch {
          // Silent fail for heartbeat
        }
      }, 30000); // Every 30 seconds
    } catch (error) {
      console.error("Failed to start analytics session:", error);
    }
  }, [isTracking]);

  // End tracking session
  const endSession = useCallback(async () => {
    if (typeof window === "undefined" || !isTracking) return;

    try {
      const sessionId = sessionStorage.getItem("analytics_session_id");
      if (sessionId) {
        await fetch("/api/analytics/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: "end",
          }),
        });
      }

      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      setIsTracking(false);
    } catch (error) {
      console.error("Failed to end analytics session:", error);
    }
  }, [isTracking]);

  // Track page view
  const trackPageView = useCallback(async (data: PageViewData = {}) => {
    if (typeof window === "undefined") return;

    try {
      const sessionId = sessionStorage.getItem("analytics_session_id");
      const urlParams = new URLSearchParams(window.location.search);
      const queryParams: Record<string, string> = {};
      urlParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      // Extract UTM params
      const utmSource = queryParams.utm_source;
      const utmMedium = queryParams.utm_medium;
      const utmCampaign = queryParams.utm_campaign;

      const res = await fetch("/api/analytics/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          pagePath: data.pagePath || window.location.pathname,
          pageTitle: data.pageTitle || document.title,
          referrer: data.referrer || document.referrer,
          utmSource,
          utmMedium,
          utmCampaign,
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      });

      const json = await res.json();
      if (json.success && json.pageView) {
        currentPageViewId.current = json.pageView.id;
        pageStartTime.current = Date.now();
      }
    } catch (error) {
      console.error("Failed to track page view:", error);
    }
  }, []);

  // Track field change
  const trackFieldChange = useCallback(async (data: FieldChangeData) => {
    if (typeof window === "undefined") return;

    try {
      await fetch("/api/analytics/field-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to track field change:", error);
    }
  }, []);

  // Track click
  const trackClick = useCallback(async () => {
    if (typeof window === "undefined") return;

    clickCount.current += 1;
    const sessionId = sessionStorage.getItem("analytics_session_id");

    try {
      await fetch("/api/analytics/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "recordAction",
        }),
      });
    } catch {
      // Silent fail
    }
  }, []);

  // Update engagement metrics
  const updateEngagement = useCallback(async () => {
    if (typeof window === "undefined" || !currentPageViewId.current) return;

    const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000);

    try {
      await fetch(`/api/analytics/pageview/${currentPageViewId.current}/engagement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeOnPage,
          scrollDepth: maxScrollDepth.current,
          clickCount: clickCount.current,
          formFills: formFillCount.current,
        }),
      });
    } catch {
      // Silent fail
    }
  }, []);

  // Track form fill
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
    maxScrollDepth,
  };
}

// Component wrapper for automatic tracking
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { startSession, endSession, trackPageView, updateEngagement, maxScrollDepth } = useAnalytics();
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Start session on mount
    startSession();

    // Track initial page view
    trackPageView({});

    // Track scroll depth with debouncing
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));
      
      if (scrollPercent > maxScrollDepth.current) {
        maxScrollDepth.current = scrollPercent;
      }
      
      // Debounce scroll updates
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        updateEngagement();
      }, 1000);
    };

    // Update engagement on page leave
    const handleBeforeUnload = () => {
      updateEngagement();
      endSession();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    // Periodic engagement update (every 30 seconds)
    const engagementInterval = setInterval(updateEngagement, 30000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(engagementInterval);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      updateEngagement();
      endSession();
    };
  }, [startSession, endSession, trackPageView, updateEngagement, maxScrollDepth]);

  return children;
}
