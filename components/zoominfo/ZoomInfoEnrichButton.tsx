"use client";

import { useState } from "react";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import ZoomInfoMatchModal, {
  type ZoomInfoMatchDefaults,
} from "@/components/zoominfo/ZoomInfoMatchModal";

type AtsEntityType = "organization" | "hiring_manager" | "job_seeker";

type Props = {
  atsEntityType: AtsEntityType;
  atsEntityId: string | number;
  matchDefaults?: ZoomInfoMatchDefaults;
  recordLabel?: string | null;
  onEnriched?: () => void;
  className?: string;
};

export default function ZoomInfoEnrichButton({
  atsEntityType,
  atsEntityId,
  matchDefaults,
  recordLabel,
  onEnriched,
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchedId, setMatchedId] = useState<string | null>(null);

  const runEnrich = async (apply: boolean, zoominfoId?: string) => {
    const idForRequest = zoominfoId || matchedId || undefined;
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
          zoominfoId: idForRequest,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Enrich failed");
      }
      if (data.needsMatch) {
        setMatchOpen(true);
        return;
      }
      if (!apply) {
        const changes: unknown[] = data.changes || [];
        if (!changes.length) {
          setMatchOpen(false);
          toast.message("ZoomInfo has nothing new to add — all fields already filled");
          return;
        }
        await runEnrich(true, idForRequest);
        return;
      }
      setMatchOpen(false);
      toast.success("Record enriched from ZoomInfo");
      onEnriched?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectMatch = async (zoominfoId: string) => {
    setMatchedId(zoominfoId);
    await runEnrich(false, zoominfoId);
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
      <ZoomInfoMatchModal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        atsEntityType={atsEntityType}
        recordLabel={recordLabel}
        defaults={matchDefaults}
        onSelect={handleSelectMatch}
        linking={busy}
      />
    </PermissionGate>
  );
}
