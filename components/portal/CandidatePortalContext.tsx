"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type PortalPlacement = {
  id: number;
  record_number?: string | number;
  job_title?: string;
  organization_name?: string;
  placement_type?: string;
  start_date?: string;
  rate_per_hour?: number;
};

type CandidatePortalContextValue = {
  userName: string;
  displayName: string;
  placements: PortalPlacement[];
  activePlacement: PortalPlacement | null;
  setActivePlacementId: (id: number) => void;
  loadingPlacements: boolean;
  refreshPlacements: () => Promise<void>;
};

const CandidatePortalContext = createContext<CandidatePortalContextValue | null>(null);

const STORAGE_KEY = "portal_active_placement_id";

export function CandidatePortalProvider({
  userName,
  displayName,
  children,
}: {
  userName: string;
  displayName: string;
  children: React.ReactNode;
}) {
  const [placements, setPlacements] = useState<PortalPlacement[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loadingPlacements, setLoadingPlacements] = useState(true);

  const refreshPlacements = useCallback(async () => {
    setLoadingPlacements(true);
    try {
      const res = await fetch("/api/portal/jobseeker/timecards/placements", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const list: PortalPlacement[] = Array.isArray(data?.placements) ? data.placements : [];
      setPlacements(list);

      let preferred: number | null = null;
      try {
        const saved = Number(localStorage.getItem(STORAGE_KEY) || 0);
        if (saved && list.some((p) => p.id === saved)) preferred = saved;
      } catch {
        /* ignore */
      }
      if (!preferred && list[0]?.id) preferred = list[0].id;
      setActiveId(preferred);
    } catch {
      setPlacements([]);
      setActiveId(null);
    } finally {
      setLoadingPlacements(false);
    }
  }, []);

  useEffect(() => {
    refreshPlacements();
  }, [refreshPlacements]);

  const setActivePlacementId = useCallback((id: number) => {
    setActiveId(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* ignore */
    }
  }, []);

  const activePlacement = useMemo(
    () => placements.find((p) => p.id === activeId) || placements[0] || null,
    [placements, activeId]
  );

  const value = useMemo(
    () => ({
      userName,
      displayName,
      placements,
      activePlacement,
      setActivePlacementId,
      loadingPlacements,
      refreshPlacements,
    }),
    [
      userName,
      displayName,
      placements,
      activePlacement,
      setActivePlacementId,
      loadingPlacements,
      refreshPlacements,
    ]
  );

  return (
    <CandidatePortalContext.Provider value={value}>{children}</CandidatePortalContext.Provider>
  );
}

export function useCandidatePortal() {
  const ctx = useContext(CandidatePortalContext);
  if (!ctx) {
    throw new Error("useCandidatePortal must be used within CandidatePortalProvider");
  }
  return ctx;
}
