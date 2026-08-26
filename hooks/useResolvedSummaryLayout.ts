"use client";

import { useEffect, useMemo, useState } from "react";
import type { ViewEntityType } from "@/lib/viewConfigEntityTypes";
import { useUserViewConfig } from "@/hooks/useUserViewConfig";
import {
  catalogPanelIds,
  getSummaryCatalog,
  mergeSummaryLayout,
  type SummaryLayout,
} from "@/lib/summaryTabLayout";

export function useResolvedSummaryLayout({
  viewEntityType,
  fieldSection,
  systemDefault,
}: {
  viewEntityType: ViewEntityType;
  fieldSection: string;
  systemDefault: SummaryLayout;
}) {
  const catalog = useMemo(
    () => getSummaryCatalog(fieldSection),
    [fieldSection]
  );
  const catalogIds = useMemo(() => catalogPanelIds(catalog), [catalog]);
  const fallback = useMemo(
    () => mergeSummaryLayout(systemDefault, catalogIds, catalog.systemDefault),
    [systemDefault, catalogIds, catalog.systemDefault]
  );

  const [adminDefault, setAdminDefault] = useState<SummaryLayout>(fallback);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/field-management/${fieldSection}/summary-layout`
        );
        const data = await response.json();
        if (!cancelled && data?.success && data.layout) {
          setAdminDefault(
            mergeSummaryLayout(data.layout, catalogIds, catalog.systemDefault)
          );
        }
      } catch {
        if (!cancelled) setAdminDefault(fallback);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fieldSection, catalogIds, catalog.systemDefault, fallback]);

  const { value, setValue, isLoading } = useUserViewConfig({
    entityType: viewEntityType,
    key: "summary_layout",
    defaultValue: adminDefault,
  });

  const layout = useMemo(
    () => mergeSummaryLayout(value, catalogIds, catalog.systemDefault),
    [value, catalogIds, catalog.systemDefault]
  );

  return {
    value: layout,
    setValue,
    isLoading,
  };
}
