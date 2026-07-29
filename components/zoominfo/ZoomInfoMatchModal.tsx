"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type AtsEntityType = "organization" | "hiring_manager" | "job_seeker";

export type ZoomInfoMatchDefaults = {
  companyName?: string | null;
  website?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
};

type CompanyItem = {
  zoominfoId: string | null;
  name?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
};

type ContactItem = {
  zoominfoId: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  title?: string | null;
  company?: { name?: string | null };
};

type Props = {
  open: boolean;
  onClose: () => void;
  atsEntityType: AtsEntityType;
  recordLabel?: string | null;
  defaults?: ZoomInfoMatchDefaults;
  onSelect: (zoominfoId: string) => void | Promise<void>;
  linking?: boolean;
};

const PLACEHOLDER =
  /^\(?\s*(not\s+specified|not\s+provided|not\s+assigned|no\s+\w+\s+provided|none|n\/a|unknown|unknown\s+id)\s*\)?$/i;

function cleanDefault(value?: string | null): string {
  const v = String(value ?? "").trim();
  if (!v || PLACEHOLDER.test(v)) return "";
  return v;
}

function normalizeWebsiteQuery(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim();
}

function contactLabel(item: ContactItem) {
  return (
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.email ||
    item.zoominfoId ||
    "Unnamed"
  );
}

export default function ZoomInfoMatchModal({
  open,
  onClose,
  atsEntityType,
  recordLabel,
  defaults,
  onSelect,
  linking = false,
}: Props) {
  const isCompany = atsEntityType === "organization";
  const entity = isCompany ? "company" : "contact";

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<Array<CompanyItem | ContactItem>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runSearch = useCallback(
    async (filters: Record<string, string | undefined>) => {
      const usable = Object.values(filters).some((v) => v && v.trim());
      if (!usable) {
        toast.error(
          isCompany
            ? "Enter a company name or website to search"
            : "Enter a name, email, or company to search"
        );
        return;
      }
      setSearching(true);
      setSelectedId(null);
      try {
        const res = await fetch("/api/zoominfo/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, filters, page: 1, pageSize: 25 }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Search failed");
        }
        setItems(data.items || []);
        setSearched(true);
        if (!(data.items || []).length) {
          toast.message(
            isCompany ? "No ZoomInfo companies found" : "No ZoomInfo contacts found"
          );
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Search failed");
      } finally {
        setSearching(false);
      }
    },
    [entity, isCompany]
  );

  const search = useCallback(() => {
    const filters = isCompany
      ? {
          companyName: companyName.trim() || undefined,
          website: normalizeWebsiteQuery(website) || undefined,
        }
      : {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          companyName: companyName.trim() || undefined,
        };
    void runSearch(filters);
  }, [companyName, website, firstName, lastName, email, isCompany, runSearch]);

  // Prefill from the ATS record and auto-search once per open.
  const autoSearchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      autoSearchedFor.current = null;
      return;
    }
    const d = {
      companyName: cleanDefault(defaults?.companyName),
      website: cleanDefault(defaults?.website),
      firstName: cleanDefault(defaults?.firstName),
      lastName: cleanDefault(defaults?.lastName),
      email: cleanDefault(defaults?.email),
    };
    const key = JSON.stringify([atsEntityType, d]);
    if (autoSearchedFor.current === key) return;
    autoSearchedFor.current = key;

    setCompanyName(d.companyName);
    setWebsite(d.website);
    setFirstName(d.firstName);
    setLastName(d.lastName);
    setEmail(d.email);
    setItems([]);
    setSelectedId(null);
    setSearched(false);

    const canAutoSearch = isCompany
      ? Boolean(d.companyName || d.website)
      : Boolean(d.email || d.lastName || d.companyName);
    if (!canAutoSearch) return;

    void runSearch(
      isCompany
        ? {
            companyName: d.companyName || undefined,
            website: normalizeWebsiteQuery(d.website) || undefined,
          }
        : {
            firstName: d.firstName || undefined,
            lastName: d.lastName || undefined,
            email: d.email || undefined,
            companyName: d.companyName || undefined,
          }
    );
  }, [open, defaults, atsEntityType, isCompany, runSearch]);

  if (!open) return null;

  const disabled = searching || linking;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Find the ZoomInfo match
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {recordLabel
                ? `Links the match to ${recordLabel} and enriches it in place — no new record is created.`
                : "Links the match to the record you're viewing and enriches it in place — no new record is created."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={linking}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {isCompany ? (
              <>
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
              </>
            ) : (
              <>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="First name…"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Last name…"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Email…"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Company name…"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={search}
            disabled={disabled}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search ZoomInfo"}
          </button>

          <div className="border rounded divide-y max-h-72 overflow-y-auto">
            {items.map((item, index) => {
              const id = item.zoominfoId ? String(item.zoominfoId) : "";
              const isSelected = Boolean(id) && id === selectedId;
              const primary = isCompany
                ? (item as CompanyItem).name || "Unnamed"
                : contactLabel(item as ContactItem);
              const secondary = isCompany
                ? [
                    (item as CompanyItem).website,
                    (item as CompanyItem).city,
                    (item as CompanyItem).state,
                    (item as CompanyItem).industry,
                  ]
                : [
                    (item as ContactItem).title,
                    (item as ContactItem).company?.name,
                    (item as ContactItem).email,
                  ];
              return (
                <button
                  key={id || `${primary}-${index}`}
                  type="button"
                  disabled={!id || linking}
                  onClick={() => setSelectedId(id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 disabled:opacity-50 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium text-gray-900">{primary}</div>
                  <div className="text-xs text-gray-500">
                    {secondary.filter(Boolean).join(" · ")}
                    {id ? ` · ZoomInfo #${id}` : ""}
                  </div>
                </button>
              );
            })}
            {!items.length && (
              <div className="px-3 py-6 text-sm text-gray-400 text-center">
                {searching
                  ? "Searching ZoomInfo…"
                  : searched
                    ? "No results — adjust the search terms above"
                    : isCompany
                      ? "Search by company name or website to begin"
                      : "Search by name, email, or company to begin"}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={linking}
            className="px-3 py-2 border border-gray-300 rounded text-sm bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedId || disabled}
            onClick={() => selectedId && void onSelect(selectedId)}
            className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {linking ? "Enriching…" : "Use this match & enrich"}
          </button>
        </div>
      </div>
    </div>
  );
}
