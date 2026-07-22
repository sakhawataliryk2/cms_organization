"use client";

import { useState } from "react";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";

type AtsEntityType = "organization" | "hiring_manager" | "job_seeker";

type Props = {
  atsEntityType: AtsEntityType;
  atsEntityId: string | number;
  onEnriched?: () => void;
  className?: string;
};

export default function ZoomInfoEnrichButton({
  atsEntityType,
  atsEntityId,
  onEnriched,
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  const runEnrich = async (apply: boolean, zoominfoId?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/zoominfo/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atsEntityType,
          atsEntityId,
          apply,
          mergeMode: "fill_empty",
          zoominfoId: zoominfoId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Enrich failed");
      }
      if (data.needsMatch) {
        setMatchOpen(true);
        toast.message("No ZoomInfo link yet — search and import, then enrich");
        return;
      }
      if (!apply) {
        const changeCount = data.changes?.length || 0;
        const ok = window.confirm(
          `ZoomInfo found ${changeCount} field update(s) (fill empty only). Apply now?`
        );
        if (ok) await runEnrich(true);
        return;
      }
      toast.success("Record enriched from ZoomInfo");
      onEnriched?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PermissionGate permission="integrations.zoominfo.enrich">
      <button
        type="button"
        disabled={busy}
        onClick={() => runEnrich(false)}
        className={
          className ||
          "px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50"
        }
        title="Enrich from ZoomInfo (fill empty fields)"
      >
        {busy ? "Enriching…" : "Enrich from ZoomInfo"}
      </button>
      {matchOpen ? null : null}
    </PermissionGate>
  );
}
