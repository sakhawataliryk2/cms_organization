"use client";

import { FiDownload, FiRefreshCw } from "react-icons/fi";

export type ZoomInfoNoteAction = "Added" | "Merged" | "Enriched";

export type ParsedZoomInfoNote = {
  action: ZoomInfoNoteAction;
  record: string | null;
  zoominfoId: string | null;
  user: string | null;
  date: string | null;
  detail: string | null;
  fieldsUpdated: string | null;
  fields: Array<{ label: string; from: string; to: string }>;
};

const HEADER = "ZoomInfo Log";

/** True when note action / type / body matches a ZoomInfo enrich or import note. */
export function isZoomInfoNote(
  action?: string | null,
  noteType?: string | null,
  text?: string | null
): boolean {
  if (/zoom\s*info/i.test(String(action || ""))) return true;
  if (/zoom\s*info/i.test(String(noteType || ""))) return true;
  if (text && String(text).split("\n")[0]?.trim() === HEADER) return true;
  return false;
}

function parseAction(raw: string | undefined): ZoomInfoNoteAction {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "added") return "Added";
  if (v === "merged") return "Merged";
  return "Enriched";
}

/**
 * Parse backend plain-text ZoomInfo note format.
 * Header lines are Key: Value; remaining lines are field diffs.
 */
export function parseZoomInfoNote(
  text: string | null | undefined
): ParsedZoomInfoNote | null {
  if (!text || typeof text !== "string") return null;
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  if (lines[0]?.trim() !== HEADER) return null;

  const meta: Record<string, string> = {};
  const fields: Array<{ label: string; from: string; to: string }> = [];
  let inFields = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^fields updated:/i.test(line)) {
      meta["fields updated"] = line.replace(/^fields updated:\s*/i, "").trim();
      inFields = true;
      continue;
    }

    if (inFields) {
      const diff = line.match(/^(.+?):\s*(.*?)\s*→\s*(.*)$/);
      if (diff) {
        fields.push({
          label: diff[1].trim(),
          from: diff[2].trim(),
          to: diff[3].trim(),
        });
      }
      continue;
    }

    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) meta[m[1].trim().toLowerCase()] = (m[2] ?? "").trim();
  }

  return {
    action: parseAction(meta.action),
    record: meta.record || null,
    zoominfoId: meta["zoominfo id"] || null,
    user: meta.user || null,
    date: meta.date || null,
    detail: meta.detail || null,
    fieldsUpdated: meta["fields updated"] || null,
    fields,
  };
}

type ZoomInfoNoteBodyProps = {
  text: string | null | undefined;
  compact?: boolean;
  className?: string;
};

function ZoomInfoNoteBody({
  text,
  compact = false,
  className = "",
}: ZoomInfoNoteBodyProps) {
  const parsed = parseZoomInfoNote(text);
  if (!parsed) {
    return (
      <p className={`text-gray-700 whitespace-pre-wrap leading-relaxed ${className}`}>
        {text || ""}
      </p>
    );
  }

  const isAdd = parsed.action === "Added";
  const ActionIcon = isAdd ? FiDownload : FiRefreshCw;
  const actionVerb = parsed.action === "Added"
    ? "Added from ZoomInfo"
    : parsed.action === "Merged"
      ? "Merged from ZoomInfo"
      : "Enriched from ZoomInfo";

  if (compact) {
    const fieldHint =
      parsed.fields.length > 0
        ? `${parsed.fields.length} field${parsed.fields.length === 1 ? "" : "s"} updated`
        : parsed.fieldsUpdated && /none/i.test(parsed.fieldsUpdated)
          ? "no new fields"
          : null;
    return (
      <div
        className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-700 ${className}`}
      >
        <span className="inline-flex items-center gap-1 font-medium text-orange-800">
          <ActionIcon className="shrink-0 opacity-80" size={14} aria-hidden />
          {parsed.action}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">ZoomInfo</span>
        {fieldHint ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600">{fieldHint}</span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-orange-100/90 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/60 px-3 py-2.5 shadow-sm ring-1 ring-orange-500/5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-800">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-700">
          <ActionIcon size={14} aria-hidden />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-orange-800/90">
          {actionVerb}
        </span>
        {parsed.record ? (
          <span className="rounded-full bg-orange-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-900">
            {parsed.record}
          </span>
        ) : null}
        {parsed.date ? (
          <>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="min-w-0">
              <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">
                Date
              </span>
              <span className="font-medium">{parsed.date}</span>
            </span>
          </>
        ) : null}
        {parsed.user ? (
          <>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="min-w-0">
              <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">
                User
              </span>
              <span className="font-medium">{parsed.user}</span>
            </span>
          </>
        ) : null}
        {parsed.zoominfoId ? (
          <>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="min-w-0">
              <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">
                ZoomInfo ID
              </span>
              <span className="font-medium tabular-nums">{parsed.zoominfoId}</span>
            </span>
          </>
        ) : null}
      </div>

      {parsed.detail ? (
        <p className="mt-2 text-xs text-slate-600">{parsed.detail}</p>
      ) : null}

      {parsed.fields.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-orange-100/80 pt-2">
          {parsed.fields.map((field, idx) => (
            <li
              key={`${field.label}-${idx}`}
              className="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              <span className="font-medium text-slate-800">{field.label}</span>
              <span className="text-slate-400">{field.from}</span>
              <span className="text-orange-400" aria-hidden>
                →
              </span>
              <span className="font-medium text-slate-800">{field.to}</span>
            </li>
          ))}
        </ul>
      ) : parsed.fieldsUpdated ? (
        <p className="mt-2 text-xs text-slate-500">{parsed.fieldsUpdated}</p>
      ) : null}

      <p className="mt-1.5 text-[10px] text-slate-400">Logged from ZoomInfo</p>
    </div>
  );
}

export default ZoomInfoNoteBody;
