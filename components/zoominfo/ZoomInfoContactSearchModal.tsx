"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "nextjs-toploader/app";

type PreviewField = { key: string; label: string; value?: string | number | null };

type ContactItem = {
  zoominfoId: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
  company?: { name?: string | null; zoominfoId?: string | null; website?: string | null };
  raw?: Record<string, unknown>;
};

type ImportTarget = "hiring_manager" | "candidate";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultTarget?: ImportTarget;
  allowCandidate?: boolean;
  organizationId?: string | number | null;
};

function PreviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 animate-pulse" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function ZoomInfoContactSearchModal({
  open,
  onClose,
  defaultTarget = "hiring_manager",
  allowCandidate = true,
  organizationId = null,
}: Props) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<ContactItem[]>([]);
  const [selected, setSelected] = useState<ContactItem | null>(null);
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([]);
  const [target, setTarget] = useState<ImportTarget>(defaultTarget);
  const [detailLevel, setDetailLevel] = useState<"basic" | "enriched">("basic");
  const [orgResolution, setOrgResolution] = useState<{
    status?: string;
    organization?: { id: number; name: string } | null;
    matches?: Array<{ id: number; name: string }>;
  } | null>(null);
  const [createOrgIfMissing, setCreateOrgIfMissing] = useState(false);
  const [chosenOrgId, setChosenOrgId] = useState<number | string | null>(
    organizationId
  );

  const reset = () => {
    setCompanyName("");
    setJobTitle("");
    setItems([]);
    setSelected(null);
    setPreviewFields([]);
    setDetailLevel("basic");
    setOrgResolution(null);
    setCreateOrgIfMissing(false);
    setChosenOrgId(organizationId);
    setTarget(defaultTarget);
    setPreviewLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const search = useCallback(async () => {
    if (!companyName.trim() && !jobTitle.trim()) {
      toast.error("Enter a company name or job title");
      return;
    }
    setSearching(true);
    setSelected(null);
    setPreviewFields([]);
    setPreviewLoading(false);
    try {
      const res = await fetch("/api/zoominfo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "contact",
          filters: {
            companyName: companyName.trim() || undefined,
            jobTitle: jobTitle.trim() || undefined,
          },
          page: 1,
          pageSize: 25,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Search failed");
      }
      setItems(data.items || []);
      if (!(data.items || []).length) toast.message("No contacts found");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [companyName, jobTitle]);

  const loadPreview = async (
    item: ContactItem,
    level: "basic" | "enriched",
    nextTarget: ImportTarget = target
  ) => {
    if (!item.zoominfoId) {
      toast.error("Missing ZoomInfo contact id");
      return;
    }
    // Open details panel immediately with skeleton, then fill in
    setSelected(item);
    setTarget(nextTarget);
    setDetailLevel(level);
    setPreviewFields([]);
    setOrgResolution(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/zoominfo/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "contact",
          zoominfoId: item.zoominfoId,
          target: nextTarget,
          detailLevel: level,
          searchItem: item,
          organizationId: chosenOrgId || organizationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Preview failed");
      }
      setPreviewFields(data.mapped?.previewFields || []);
      setOrgResolution(data.orgResolution || null);
      if (data.orgResolution?.organization?.id) {
        setChosenOrgId(data.orgResolution.organization.id);
      }
      if (level === "enriched") {
        toast.success("Enriched details loaded (may use ZoomInfo credits)");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const importContact = async () => {
    if (!selected?.zoominfoId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/zoominfo/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "contact",
          zoominfoId: selected.zoominfoId,
          target,
          resolution: "create",
          searchItem: selected,
          organizationId: chosenOrgId || undefined,
          createOrganizationIfMissing:
            target === "hiring_manager" ? createOrgIfMissing : false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.needsOrganization) {
          setOrgResolution(data.orgResolution || { status: "not_found" });
          toast.error(
            "Link or create an organization before importing this hiring manager"
          );
          return;
        }
        throw new Error(data.message || "Import failed");
      }
      toast.success(
        target === "candidate"
          ? "Candidate imported from ZoomInfo contact"
          : "Hiring manager imported from ZoomInfo"
      );
      const id = data.record?.id;
      handleClose();
      if (id) {
        router.push(
          target === "candidate"
            ? `/dashboard/job-seekers/view?id=${id}`
            : `/dashboard/hiring-managers/view?id=${id}`
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Search ZoomInfo Contacts
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Import as Hiring Manager or Candidate (same ZoomInfo Contact API)
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name…"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Job title…"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search contacts"}
          </button>

          <div className="border rounded divide-y max-h-56 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.zoominfoId || `${item.firstName}-${item.lastName}`}
                type="button"
                onClick={() => loadPreview(item, "basic")}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                  selected?.zoominfoId === item.zoominfoId ? "bg-blue-50" : ""
                }`}
              >
                <div className="font-medium text-gray-900">
                  {[item.firstName, item.lastName].filter(Boolean).join(" ") ||
                    "Unnamed"}
                </div>
                <div className="text-xs text-gray-500">
                  {[item.title, item.company?.name, item.email]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
            ))}
            {!items.length && !searching && (
              <div className="px-3 py-6 text-sm text-gray-400 text-center">
                Search for contacts to begin
              </div>
            )}
          </div>

          {selected && (
            <div className="border rounded p-3 bg-gray-50 space-y-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <h3 className="text-sm font-semibold">Import as</h3>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={target === "hiring_manager"}
                      disabled={previewLoading}
                      onChange={() =>
                        loadPreview(selected, detailLevel, "hiring_manager")
                      }
                    />
                    Hiring Manager
                  </label>
                  {allowCandidate && (
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={target === "candidate"}
                        disabled={previewLoading}
                        onChange={() =>
                          loadPreview(selected, detailLevel, "candidate")
                        }
                      />
                      Candidate
                    </label>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={previewLoading || detailLevel === "enriched"}
                onClick={() => loadPreview(selected, "enriched")}
                className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
              >
                {detailLevel === "enriched"
                  ? "Enriched"
                  : previewLoading
                    ? "Loading…"
                    : "Load enriched details (credits)"}
              </button>

              {previewLoading ? (
                <PreviewSkeleton />
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {previewFields.map((f) => (
                    <div key={f.key}>
                      <dt className="text-xs text-gray-500">{f.label}</dt>
                      <dd className="text-gray-900">{f.value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {!previewLoading && target === "hiring_manager" && (
                <div className="text-xs space-y-2 border-t pt-2">
                  <div>
                    Org resolution:{" "}
                    <strong>{orgResolution?.status || "unknown"}</strong>
                    {orgResolution?.organization?.name
                      ? ` → ${orgResolution.organization.name}`
                      : ""}
                  </div>
                  {(orgResolution?.matches?.length || 0) > 1 && (
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={chosenOrgId ?? ""}
                      onChange={(e) => setChosenOrgId(e.target.value)}
                    >
                      <option value="">Select organization…</option>
                      {orgResolution?.matches?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {(orgResolution?.status === "not_found" ||
                    orgResolution?.status === "ambiguous") && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createOrgIfMissing}
                        onChange={(e) => setCreateOrgIfMissing(e.target.checked)}
                      />
                      Create organization from company if missing
                    </label>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={importing || previewLoading}
                onClick={importContact}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
