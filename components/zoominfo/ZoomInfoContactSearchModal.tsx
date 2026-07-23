"use client";

import { useCallback, useMemo, useState } from "react";
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

function contactLabel(item: ContactItem) {
  return (
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.email ||
    item.zoominfoId ||
    "Unnamed"
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
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [items, setItems] = useState<ContactItem[]>([]);
  const [selected, setSelected] = useState<ContactItem | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([]);
  const [target, setTarget] = useState<ImportTarget>(defaultTarget);
  const [detailLevel, setDetailLevel] = useState<"basic" | "enriched">("basic");
  const [orgResolution, setOrgResolution] = useState<{
    status?: string;
    organization?: { id: number; name: string } | null;
    matches?: Array<{ id: number; name: string }>;
    companyName?: string | null;
    companyApiId?: string | null;
    canCreateOrganization?: boolean;
  } | null>(null);
  const [createOrgIfMissing, setCreateOrgIfMissing] = useState(false);
  const [duplicates, setDuplicates] = useState<{
    recordNumber?: Array<{
      id: number;
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string | null;
      title?: string | null;
      record_number?: number;
    }>;
  } | null>(null);
  const [chosenOrgId, setChosenOrgId] = useState<number | string | null>(
    organizationId
  );

  const canBulkSelect = target === "hiring_manager";

  const checkedItems = useMemo(
    () => items.filter((i) => i.zoominfoId && checkedIds.has(String(i.zoominfoId))),
    [items, checkedIds]
  );

  const allVisibleChecked =
    items.length > 0 &&
    items.every((i) => !i.zoominfoId || checkedIds.has(String(i.zoominfoId)));

  const reset = () => {
    setCompanyName("");
    setJobTitle("");
    setItems([]);
    setSelected(null);
    setCheckedIds(new Set());
    setPreviewFields([]);
    setDetailLevel("basic");
    setOrgResolution(null);
    setDuplicates(null);
    setCreateOrgIfMissing(false);
    setChosenOrgId(organizationId);
    setTarget(defaultTarget);
    setPreviewLoading(false);
    setBulkProgress(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleChecked = (zoominfoId: string, next?: boolean) => {
    setCheckedIds((prev) => {
      const copy = new Set(prev);
      const shouldCheck = next ?? !copy.has(zoominfoId);
      if (shouldCheck) copy.add(zoominfoId);
      else copy.delete(zoominfoId);
      return copy;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleChecked) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(
      new Set(items.map((i) => i.zoominfoId).filter(Boolean).map(String))
    );
  };

  const search = useCallback(async () => {
    if (!companyName.trim() && !jobTitle.trim()) {
      toast.error("Enter a company name or job title");
      return;
    }
    setSearching(true);
    setSelected(null);
    setCheckedIds(new Set());
    setPreviewFields([]);
    setPreviewLoading(false);
    setBulkProgress(null);
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
      // Clear stale selection preview when searching again
      setDuplicates(null);
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
    setSelected(item);
    setTarget(nextTarget);
    setDetailLevel(level);
    setPreviewFields([]);
    setOrgResolution(null);
    setDuplicates(null);
    setPreviewLoading(true);
    if (nextTarget !== "hiring_manager") {
      setCheckedIds(new Set());
    }
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
      setDuplicates(data.duplicates || null);
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

  const importOne = async (
    item: ContactItem,
    resolution: "create" | "merge" = "create",
    existingRecordId?: number | null
  ) => {
    const res = await fetch("/api/zoominfo/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "contact",
        zoominfoId: item.zoominfoId,
        target,
        resolution,
        searchItem: item,
        organizationId: chosenOrgId || undefined,
        createOrganizationIfMissing: createOrgIfMissing,
        existingRecordId:
          resolution === "merge"
            ? existingRecordId || duplicates?.recordNumber?.[0]?.id || null
            : null,
      }),
    });
    const data = await res.json();
    if (data.needsDuplicateDecision) {
      setDuplicates(data.duplicates || null);
      const err = new Error(
        "This ZoomInfo contact already exists in ATS — choose merge"
      ) as Error & {
        needsDuplicateDecision?: boolean;
        duplicates?: unknown;
        data?: unknown;
      };
      err.needsDuplicateDecision = true;
      err.duplicates = data.duplicates;
      err.data = data;
      throw err;
    }
    if (!res.ok || !data.success) {
      const err = new Error(data.message || "Import failed") as Error & {
        needsOrganization?: boolean;
        orgResolution?: unknown;
        data?: unknown;
      };
      err.needsOrganization = Boolean(data.needsOrganization);
      err.orgResolution = data.orgResolution;
      err.data = data;
      throw err;
    }
    return data;
  };

  const importContact = async (resolution: "create" | "merge" = "create") => {
    if (!selected?.zoominfoId) return;
    if (
      resolution === "create" &&
      (duplicates?.recordNumber?.length || 0) > 0
    ) {
      toast.error(
        "This contact already exists (same ZoomInfo / record number). Use Merge instead."
      );
      return;
    }
    setImporting(true);
    try {
      const data = await importOne(
        selected,
        resolution,
        duplicates?.recordNumber?.[0]?.id || null
      );
      toast.success(
        resolution === "merge"
          ? target === "candidate"
            ? "Candidate merged from ZoomInfo"
            : "Hiring manager merged from ZoomInfo"
          : data.organizationCreatedFromZoomInfo
            ? target === "candidate"
              ? "Candidate imported — organization created from ZoomInfo"
              : "Hiring manager imported — organization created from ZoomInfo"
            : target === "candidate"
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
      const err = e as Error & {
        needsOrganization?: boolean;
        needsDuplicateDecision?: boolean;
        orgResolution?: { status?: string };
      };
      if (err.needsDuplicateDecision) {
        toast.error(
          "Duplicate found — use Merge into existing"
        );
      } else if (err.needsOrganization) {
        setOrgResolution(err.orgResolution || { status: "not_found" });
        toast.error(
          "Link or create an organization before importing this hiring manager"
        );
      } else {
        toast.error(err.message || "Import failed");
      }
    } finally {
      setImporting(false);
    }
  };

  const importSelectedHiringManagers = async () => {
    if (!canBulkSelect || checkedItems.length === 0) return;

    const ok = window.confirm(
      `Import ${checkedItems.length} hiring manager${checkedItems.length === 1 ? "" : "s"} from ZoomInfo?`
    );
    if (!ok) return;

    setImporting(true);
    let success = 0;
    const failures: string[] = [];

    try {
      for (let i = 0; i < checkedItems.length; i++) {
        const item = checkedItems[i];
        setBulkProgress(`Importing ${i + 1} of ${checkedItems.length}…`);
        try {
          // Prefer merge when this ZoomInfo id already exists as record_number
          let resolution: "create" | "merge" = "create";
          let existingId: number | null = null;
          try {
            await importOne(item, "create");
          } catch (firstErr: unknown) {
            const fe = firstErr as Error & {
              needsDuplicateDecision?: boolean;
              duplicates?: {
                recordNumber?: Array<{ id: number }>;
              };
            };
            if (fe.needsDuplicateDecision && fe.duplicates?.recordNumber?.[0]?.id) {
              existingId = fe.duplicates.recordNumber[0].id;
              resolution = "merge";
              await importOne(item, "merge", existingId);
            } else {
              throw firstErr;
            }
          }
          success += 1;
        } catch (e: unknown) {
          const err = e as Error & { needsOrganization?: boolean };
          if (err.needsOrganization) {
            setOrgResolution(
              (err as { orgResolution?: { status?: string } }).orgResolution || {
                status: "not_found",
              }
            );
            failures.push(
              `${contactLabel(item)}: link/create organization first`
            );
            // Stop early — remaining will hit the same org issue
            break;
          }
          failures.push(
            `${contactLabel(item)}: ${err instanceof Error ? err.message : "failed"}`
          );
        }
      }

      if (success > 0 && failures.length === 0) {
        toast.success(
          `Imported ${success} hiring manager${success === 1 ? "" : "s"}`
        );
        handleClose();
        router.push("/dashboard/hiring-managers");
      } else if (success > 0) {
        toast.warning(
          `Imported ${success}; ${failures.length} failed. ${failures[0] || ""}`
        );
        setCheckedIds(new Set());
      } else {
        toast.error(failures[0] || "Bulk import failed");
      }
    } finally {
      setImporting(false);
      setBulkProgress(null);
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
              {canBulkSelect
                ? "Select multiple contacts to import as hiring managers"
                : "Import as Hiring Manager or Candidate"}
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

          {canBulkSelect && items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={toggleSelectAll}
                  disabled={importing}
                />
                Select all ({items.length})
              </label>
              <button
                type="button"
                disabled={importing || checkedItems.length === 0}
                onClick={importSelectedHiringManagers}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                {importing && bulkProgress
                  ? bulkProgress
                  : `Import selected (${checkedItems.length})`}
              </button>
            </div>
          )}

          <div className="border rounded divide-y max-h-56 overflow-y-auto">
            {items.map((item) => {
              const id = item.zoominfoId ? String(item.zoominfoId) : "";
              const isChecked = id ? checkedIds.has(id) : false;
              const isSelected = selected?.zoominfoId === item.zoominfoId;
              return (
                <div
                  key={id || `${item.firstName}-${item.lastName}`}
                  className={`flex items-start gap-2 px-3 py-2 text-sm hover:bg-blue-50 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                >
                  {canBulkSelect && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={isChecked}
                      disabled={!id || importing}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (id) toggleChecked(id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${contactLabel(item)}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => loadPreview(item, "enriched")}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-gray-900">
                      {contactLabel(item)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[item.title, item.company?.name, item.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </button>
                </div>
              );
            })}
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
                      disabled={previewLoading || importing}
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
                        disabled={previewLoading || importing}
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
                disabled={previewLoading || detailLevel === "enriched" || importing}
                onClick={() => loadPreview(selected, "enriched")}
                className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
              >
                {detailLevel === "enriched"
                  ? "Enriched"
                  : previewLoading
                    ? "Loading…"
                    : "Reload enriched details"}
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

              {!previewLoading &&
                (target === "hiring_manager" || target === "candidate") && (
                <div className="text-xs space-y-2 border-t pt-2">
                  <div>
                    Org resolution:{" "}
                    <strong>{orgResolution?.status || "unknown"}</strong>
                    {orgResolution?.organization?.name
                      ? ` → ${orgResolution.organization.name}`
                      : orgResolution?.companyName
                        ? ` → ${orgResolution.companyName}`
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
                  {(orgResolution?.status === "can_create_from_zoominfo" ||
                    orgResolution?.canCreateOrganization) && (
                    <label className="flex items-start gap-2 text-xs text-gray-800 bg-blue-50 border border-blue-200 rounded p-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={createOrgIfMissing}
                        onChange={(e) => setCreateOrgIfMissing(e.target.checked)}
                        disabled={importing}
                      />
                      <span>
                        Create organization from ZoomInfo if missing
                        {orgResolution?.companyApiId
                          ? ` (company id ${orgResolution.companyApiId})`
                          : ""}
                        {orgResolution?.companyName
                          ? ` — ${orgResolution.companyName}`
                          : ""}
                        . Uses 1 enrich credit when checked.
                      </span>
                    </label>
                  )}
                  {orgResolution?.status === "not_found" &&
                    !orgResolution?.canCreateOrganization && (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                        No ZoomInfo company id available — organization name will
                        be stored as text if present.
                      </div>
                    )}
                </div>
              )}

              {!previewLoading &&
                (duplicates?.recordNumber?.length || 0) > 0 && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                    Already in ATS:{" "}
                    <strong>
                      {duplicates?.recordNumber?.[0]?.name ||
                        `#${duplicates?.recordNumber?.[0]?.record_number}`}
                    </strong>
                    {duplicates?.recordNumber?.[0]?.email
                      ? ` (${duplicates.recordNumber[0].email})`
                      : ""}
                    . Record number / ZoomInfo id matches — use merge to update
                    empty fields.
                  </div>
                )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    importing ||
                    previewLoading ||
                    (duplicates?.recordNumber?.length || 0) > 0
                  }
                  onClick={() => importContact("create")}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {importing && !bulkProgress
                    ? "Importing…"
                    : target === "candidate"
                      ? "Create candidate"
                      : "Create hiring manager"}
                </button>
                {!previewLoading &&
                  (duplicates?.recordNumber?.length || 0) > 0 && (
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => importContact("merge")}
                      className="px-3 py-2 border border-gray-300 rounded text-sm bg-white disabled:opacity-50"
                    >
                      Merge into existing
                    </button>
                  )}
                {canBulkSelect && checkedItems.length > 1 && (
                  <button
                    type="button"
                    disabled={importing || previewLoading}
                    onClick={importSelectedHiringManagers}
                    className="px-3 py-2 border border-gray-300 rounded text-sm bg-white disabled:opacity-50"
                  >
                    Import selected ({checkedItems.length})
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
