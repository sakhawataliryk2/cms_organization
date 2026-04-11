"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FiChevronDown, FiMessageSquare, FiPaperclip, FiPhone } from "react-icons/fi";
import { formatPhoneForDisplay, phoneDigitsForTel } from "@/lib/formatPhoneDisplay";

export type ZoomPhoneNoteKind = "call" | "sms" | null;

/** Detect stored Zoom Phone call / SMS note shapes (backend plain-text format). */
export function getZoomPhoneNoteKind(text: string | null | undefined): ZoomPhoneNoteKind {
  if (!text || typeof text !== "string") return null;
  const first = text.split("\n")[0]?.trim();
  if (first === "Call Log") return "call";
  if (first === "SMS Log") return "sms";
  return null;
}

function parseCallLog(text: string): Record<string, string> | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== "Call Log") return null;
  const data: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^([^:]+):\s*(.*)$/);
    if (m) data[m[1].trim().toLowerCase()] = m[2].trim();
  }
  if (!data.type && !data.number) return null;
  return data;
}

type SmsEntry =
  | { kind: "message"; time: string; direction: "Incoming" | "Outgoing"; body: string }
  | { kind: "attachment"; name: string };

/** HH:mm or HH:mm:ss → seconds from midnight (same-day ordering). */
function timeBracketToSortKey(bracket: string): number {
  const parts = bracket.split(":").map((x) => parseInt(x, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return h * 3600 + m * 60 + s;
}

/**
 * Parse SMS transcript; sort by wall time (supports HH:mm:ss from backend).
 * Attachments keep order after the preceding message using a tiny fractional offset.
 */
function parseSmsLog(text: string): SmsEntry[] | null {
  const rawLines = text.split("\n");
  if (rawLines[0]?.trim() !== "SMS Log") return null;

  type Tagged = { entry: SmsEntry; sortKey: number; orig: number };
  const tagged: Tagged[] = [];
  let lastMsgKey = 0;
  let seq = 0;

  const lineRegex = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(Incoming|Outgoing):\s*(.*)$/;

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim()) continue;
    seq += 1;

    const tMatch = line.match(lineRegex);
    if (tMatch) {
      lastMsgKey = timeBracketToSortKey(tMatch[1]);
      tagged.push({
        sortKey: lastMsgKey,
        orig: i,
        entry: {
          kind: "message",
          time: tMatch[1],
          direction: tMatch[2] as "Incoming" | "Outgoing",
          body: tMatch[3] || "—",
        },
      });
      continue;
    }

    const aMatch = line.match(/^\[Attachment:\s*(.+?)\]\s*$/);
    if (aMatch) {
      tagged.push({
        sortKey: lastMsgKey + seq * 1e-6,
        orig: i,
        entry: { kind: "attachment", name: aMatch[1].trim() },
      });
    }
  }

  if (tagged.length === 0) return null;
  tagged.sort((a, b) => a.sortKey - b.sortKey || a.orig - b.orig);
  return tagged.map((t) => t.entry);
}

/** Call log "Number:" value — format E.164 / intl consistently */
function displayCallLogNumber(value: string): string {
  if (!value || value === "—") return value;
  const d = phoneDigitsForTel(value);
  if (d.length >= 8) return formatPhoneForDisplay(value);
  return value;
}

/** Highlight +intl and US-style phone chunks inside SMS / plain note lines */
function formatInlinePhonesInNoteText(text: string): ReactNode {
  const re =
    /\+\d[\d().\s-]{6,22}\d|\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}[-.]\d{3}[-.]\d{4}\b/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, "g");
  while ((m = r.exec(text)) !== null) {
    out.push(text.slice(last, m.index));
    const raw = m[0];
    const d = phoneDigitsForTel(raw);
    if (d.length >= 10 && d.length <= 15) {
      out.push(
        <span key={`ph-${m.index}-${d}`} className="font-medium tabular-nums">
          {formatPhoneForDisplay(raw)}
        </span>
      );
    } else {
      out.push(raw);
    }
    last = m.index + raw.length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

const SMS_COLLAPSED_MAX_PX = 260;
const CALL_COLLAPSED_MAX_PX = 120;

function CollapsibleZoomShell({
  children,
  collapsedMaxPx,
  fadeBottomClass,
}: {
  children: React.ReactNode;
  collapsedMaxPx: number;
  /** Gradient that matches the card background at the bottom */
  fadeBottomClass: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setFullHeight(el.scrollHeight);
    const ro = new ResizeObserver(() => {
      setFullHeight(innerRef.current?.scrollHeight ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const needsToggle = fullHeight > collapsedMaxPx + 6;
  const appliedMax = !needsToggle ? fullHeight : expanded ? fullHeight : collapsedMaxPx;
  const showFade = needsToggle && !expanded;

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden transition-[max-height] duration-500 ease-in-out motion-reduce:transition-none"
        style={{ maxHeight: `${Math.ceil(appliedMax)}px` }}
      >
        <div ref={innerRef}>{children}</div>
        {showFade ? (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-14 rounded-b-lg bg-gradient-to-t ${fadeBottomClass} backdrop-blur-[2px]`}
            aria-hidden
          />
        ) : null}
      </div>

      {needsToggle ? (
        <div className="relative z-[2] flex justify-center border-t border-black/[0.04] pt-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
          >
            <FiChevronDown
              className={`h-4 w-4 shrink-0 transition-transform duration-500 ease-in-out motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CallLogCard({
  data,
  compact,
}: {
  data: Record<string, string>;
  compact: boolean;
}) {
  const type = data.type || "—";
  const number = data.number || "—";
  const duration = data.duration || "—";
  const date = data.date || "—";
  const recruiter = data.recruiter;

  const inbound = /inbound/i.test(type);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-700">
        <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
          <FiPhone className="shrink-0 opacity-80" size={14} aria-hidden />
          Call
        </span>
        <span className="text-slate-300">·</span>
        <span
          className={`rounded px-1.5 py-0 text-[11px] font-semibold uppercase tracking-wide ${
            inbound ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
          }`}
        >
          {type}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">{duration}</span>
        <span className="text-slate-300">·</span>
        <span className="truncate text-slate-600 tabular-nums">{displayCallLogNumber(number)}</span>
      </div>
    );
  }

  const inner = (
    <div className="rounded-lg border border-indigo-100/90 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50/80 px-3 py-2.5 shadow-sm ring-1 ring-indigo-500/5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-800">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
          <FiPhone size={14} aria-hidden />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-700/90">Phone call</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            inbound ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
          }`}
        >
          {type}
        </span>
        <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
        <span className="min-w-0">
          <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">Number</span>
          <span className="font-medium break-all tabular-nums">{displayCallLogNumber(number)}</span>
        </span>
        <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
        <span>
          <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">Duration</span>
          <span className="font-medium tabular-nums">{duration}</span>
        </span>
        <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
        <span className="min-w-0">
          <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">Date</span>
          <span className="font-medium">{date}</span>
        </span>
        {recruiter ? (
          <>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="min-w-0">
              <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">Recruiter</span>
              <span className="font-medium">{recruiter}</span>
            </span>
          </>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-slate-400">Logged from Zoom Phone</p>
    </div>
  );

  return (
    <CollapsibleZoomShell
      collapsedMaxPx={CALL_COLLAPSED_MAX_PX}
      fadeBottomClass="from-indigo-50/95 via-white/80 to-transparent"
    >
      {inner}
    </CollapsibleZoomShell>
  );
}

function SmsLogCard({ entries, compact }: { entries: SmsEntry[]; compact: boolean }) {
  const msgCount = entries.filter((e) => e.kind === "message").length;
  const attCount = entries.filter((e) => e.kind === "attachment").length;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-700">
        <span className="inline-flex items-center gap-1 font-medium text-teal-800">
          <FiMessageSquare className="shrink-0 opacity-80" size={14} aria-hidden />
          SMS
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">
          {msgCount} message{msgCount !== 1 ? "s" : ""}
          {attCount > 0 ? ` · ${attCount} file${attCount !== 1 ? "s" : ""}` : ""}
        </span>
      </div>
    );
  }

  const inner = (
    <div className="rounded-lg border border-teal-100/90 bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/50 p-3 shadow-sm ring-1 ring-teal-500/5">
      <div className="mb-3 flex items-center gap-2 border-b border-teal-100/80 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
          <FiMessageSquare size={16} aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800/90">SMS thread</p>
          <p className="text-[11px] text-slate-500">Conversation from Zoom Phone · sorted by time</p>
        </div>
      </div>
      <ul className="space-y-2">
        {entries.map((entry, idx) => {
          if (entry.kind === "attachment") {
            return (
              <li
                key={`a-${idx}-${entry.name}`}
                className="flex items-start gap-2 rounded-md border border-dashed border-teal-200/80 bg-teal-50/40 px-2.5 py-2 text-sm text-teal-900/90"
              >
                <FiPaperclip className="mt-0.5 shrink-0 text-teal-600" size={14} aria-hidden />
                <span className="font-medium">{entry.name}</span>
              </li>
            );
          }
          const incoming = entry.direction === "Incoming";
          return (
            <li
              key={`m-${idx}-${entry.time}-${entry.direction}`}
              className={`rounded-lg border px-2.5 py-2 text-sm shadow-sm ${
                incoming ? "border-slate-200/90 bg-slate-50/90" : "border-teal-200/70 bg-white"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                  {entry.time}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    incoming ? "bg-slate-200/90 text-slate-700" : "bg-teal-600 text-white"
                  }`}
                >
                  {entry.direction}
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
                {formatInlinePhonesInNoteText(entry.body)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <CollapsibleZoomShell
      collapsedMaxPx={SMS_COLLAPSED_MAX_PX}
      fadeBottomClass="from-emerald-50/95 via-white/85 to-transparent"
    >
      {inner}
    </CollapsibleZoomShell>
  );
}

type ZoomPhoneNoteBodyProps = {
  text: string | null | undefined;
  /** Shorter one-line style for side panels / previews */
  compact?: boolean;
  /** Plain note fallback classes */
  className?: string;
};

/**
 * Renders Zoom Phone call / SMS transcript notes with light structured styling;
 * falls back to a normal paragraph for other note text.
 */
export default function ZoomPhoneNoteBody({
  text,
  compact = false,
  className = "text-gray-700 whitespace-pre-wrap leading-relaxed",
}: ZoomPhoneNoteBodyProps) {
  const raw = text ?? "";
  const callData = parseCallLog(raw);
  if (callData) {
    return <CallLogCard data={callData} compact={compact} />;
  }
  const smsEntries = parseSmsLog(raw);
  if (smsEntries) {
    return <SmsLogCard entries={smsEntries} compact={compact} />;
  }
  return <p className={className}>{formatInlinePhonesInNoteText(raw)}</p>;
}
