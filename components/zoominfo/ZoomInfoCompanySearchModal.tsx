"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "nextjs-toploader/app";

type PreviewField = { key: string; label: string; value?: string | number | null };

type CompanyItem = {
  zoominfoId: string | null;
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  raw?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported?: (record: { id: number | string }) => void;
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

function normalizeWebsiteQuery(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim();
}

export default function ZoomInfoCompanySearchModal({
  open,
  onClose,
  onImported,
}: Props) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [searching, setSearching] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<CompanyItem[]>([]);
  const [selected, setSelected] = useState<CompanyItem | null>(null);
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([]);
  const [detailLevel, setDetailLevel] = useState<"basic" | "enriched">("basic");
  const [duplicates, setDuplicates] = useState<{
    phone?: Array<{ id: number; name: string }>;
    website?: Array<{ id: number; name: string }>;
  } | null>(null);

  const reset = () => {
    setCompanyName("");
    setWebsite("");
    setItems([]);
    setSelected(null);
    setPreviewFields([]);
    setDetailLevel("basic");
    setDuplicates(null);
    setPreviewLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const search = useCallback(async () => {
    const name = companyName.trim();
    const site = normalizeWebsiteQuery(website);
    if (!name && !site) {
      toast.error("Enter a company name or website");
      return;
    }
    setSearching(true);
    setSelected(null);
    setPreviewFields([]);
    setDuplicates(null);
    setPreviewLoading(false);
    try {
      const res = await fetch("/api/zoominfo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "company",
          filters: {
            companyName: name || undefined,
            website: site || undefined,
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
      if (!(data.items || []).length) toast.message("No companies found");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [companyName, website]);

  const loadPreview = async (
    item: CompanyItem,
    level: "basic" | "enriched" = "basic"
  ) => {
    if (!item.zoominfoId) {
      toast.error("Missing ZoomInfo company id");
      return;
    }
    setSelected(item);
    setPreviewFields([]);
    setDuplicates(null);
    setDetailLevel(level);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/zoominfo/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "company",
          zoominfoId: item.zoominfoId,
          target: "organization",
          detailLevel: level,
          searchItem: item,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Preview failed");
      }
      setPreviewFields(data.mapped?.previewFields || []);
      setDuplicates(data.duplicates || null);
      if (level === "enriched") {
        toast.success("Enriched details loaded (may use ZoomInfo credits)");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const importCompany = async (resolution: "create" | "merge" = "create") => {
    if (!selected?.zoominfoId) return;
    const dupPhone = duplicates?.phone?.length || 0;
    const dupWeb = duplicates?.website?.length || 0;
    if (resolution === "create" && (dupPhone || dupWeb)) {
      const ok = window.confirm(
        "Possible duplicate organizations found. Create anyway?"
      );
      if (!ok) return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/zoominfo/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "company",
          zoominfoId: selected.zoominfoId,
          target: "organization",
          resolution,
          searchItem: selected,
          existingRecordId:
            resolution === "merge"
              ? duplicates?.website?.[0]?.id || duplicates?.phone?.[0]?.id
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.needsDuplicateDecision) {
          setDuplicates(data.duplicates);
          toast.error("Duplicates detected — choose create or merge");
          return;
        }
        throw new Error(data.message || "Import failed");
      }
      toast.success("Organization imported from ZoomInfo");
      const id = data.record?.id;
      handleClose();
      if (id) {
        onImported?.(data.record);
        router.push(`/dashboard/organizations/view?id=${id}`);
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
              Search ZoomInfo Companies
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Search by company name and/or website
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
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Company name…"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Website (e.g. acme.com)…"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>

          <div className="border rounded divide-y max-h-56 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.zoominfoId || item.name || Math.random()}
                type="button"
                onClick={() => loadPreview(item, "enriched")}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                  selected?.zoominfoId === item.zoominfoId ? "bg-blue-50" : ""
                }`}
              >
                <div className="font-medium text-gray-900">
                  {item.name || "Unnamed"}
                </div>
                <div className="text-xs text-gray-500">
                  {[item.website, item.city, item.state, item.industry]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
            ))}
            {!items.length && !searching && (
              <div className="px-3 py-6 text-sm text-gray-400 text-center">
                Search by name or website to begin
              </div>
            )}
          </div>

          {selected && (
            <div className="border rounded p-3 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Import preview</h3>
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
                      : "Reload enriched details"}
                </button>
              </div>
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
              {!previewLoading &&
              (duplicates?.phone?.length || duplicates?.website?.length) ? (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Possible duplicates detected. You can still create or merge.
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={importing || previewLoading}
                  onClick={() => importCompany("create")}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {importing ? "Importing…" : "Create organization"}
                </button>
                {!previewLoading &&
                  (duplicates?.website?.[0] || duplicates?.phone?.[0]) && (
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => importCompany("merge")}
                      className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                    >
                      Merge into duplicate
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
