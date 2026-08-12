"use client";

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { FiChevronRight, FiChevronDown } from "react-icons/fi";

export type OutlookEmailDirection = "inbound" | "outbound" | "unknown";

export type ParsedOutlookEmailNote = {
  direction: OutlookEmailDirection;
  when: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  subject: string | null;
  body: string;
};

const HEADER_RE = /^\[Outlook Email\s*[—–-]\s*(INBOUND|OUTBOUND|UNKNOWN)\]\s*$/i;

/** True when note action / type / body matches journaled Outlook email. */
export function isOutlookEmailNote(
  action?: string | null,
  noteType?: string | null,
  text?: string | null
): boolean {
  if (/outlook\s*email/i.test(String(action || ""))) return true;
  if (
    String(noteType || "").trim().toLowerCase() === "email" &&
    text &&
    HEADER_RE.test(String(text).split("\n")[0]?.trim() || "")
  ) {
    return true;
  }
  if (text && HEADER_RE.test(String(text).split("\n")[0]?.trim() || "")) return true;
  return false;
}

function parseDirection(raw: string | undefined): OutlookEmailDirection {
  const d = String(raw || "").toLowerCase();
  if (d === "inbound") return "inbound";
  if (d === "outbound") return "outbound";
  return "unknown";
}

/**
 * Parse backend plain-text Outlook journal note format.
 * Only scans header lines (fast) — body is sliced after the blank line following Subject.
 */
export function parseOutlookEmailNote(
  text: string | null | undefined
): ParsedOutlookEmailNote | null {
  if (!text || typeof text !== "string") return null;
  const lines = text.split(/\r?\n/);
  if (!lines.length) return null;

  const first = lines[0].trim();
  const headerMatch = first.match(HEADER_RE);
  if (!headerMatch) return null;

  const meta: Record<string, string> = {};
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      break;
    }
    const m = line.match(/^(When|From|To|Cc|Subject):\s*(.*)$/i);
    if (m) {
      meta[m[1].toLowerCase()] = m[2] ?? "";
    } else if (i > 8) {
      break;
    }
  }

  const body = lines.slice(i).join("\n").replace(/^\s+/, "").replace(/\s+$/, "");

  return {
    direction: parseDirection(headerMatch[1]),
    when: meta.when?.trim() || null,
    from: meta.from?.trim() || null,
    to: meta.to?.trim() || null,
    cc: meta.cc?.trim() || null,
    subject: meta.subject?.trim() || null,
    body,
  };
}

/** Match client ATS activity row date: 08/12/2026, 11:41 AM */
function formatActivityWhen(when: string | null): string {
  if (!when) return "—";
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return when;
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWhenFull(when: string): string {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return when;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayNameFromAddress(addr: string | null): string {
  if (!addr) return "Unknown";
  if (!addr.includes("@")) return addr;
  const local = addr.split("@")[0] || addr;
  return local.replace(/[._+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bodyPeek(body: string, max = 120): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (!oneLine) return "No message content";
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max).trimEnd() + "…";
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* ignore */
  }
}

type OutlookEmailNoteBodyProps = {
  text: string | null | undefined;
  /** Side panels / previews — denser single-line peek */
  compact?: boolean;
  defaultExpanded?: boolean;
  className?: string;
};

function OutlookEmailNoteBodyInner({
  text,
  compact = false,
  defaultExpanded = false,
  className = "",
}: OutlookEmailNoteBodyProps) {
  const parsed = useMemo(() => parseOutlookEmailNote(text), [text]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [actionsOpen]);

  const toggle = useCallback(() => {
    if (compact) return;
    setExpanded((v) => !v);
  }, [compact]);

  if (!parsed) {
    return (
      <p className={`text-gray-700 whitespace-pre-wrap leading-relaxed ${className}`}>
        {text || ""}
      </p>
    );
  }

  const isIn = parsed.direction === "inbound";
  const isOut = parsed.direction === "outbound";
  const typeLabel = isIn
    ? "Inbound Email"
    : isOut
      ? "Outbound Email"
      : "Email";
  const peer = isIn ? parsed.from : parsed.to;
  const peerLabel = displayNameFromAddress(peer);
  const subject = parsed.subject || "(no subject)";
  const whenLabel = formatActivityWhen(parsed.when);

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 min-w-0 text-xs text-gray-800 py-1 ${className}`}
      >
        <span className="text-gray-400 shrink-0" aria-hidden>
          ›
        </span>
        <span className="text-gray-600 shrink-0 tabular-nums">{whenLabel}</span>
        <span className="text-gray-400 shrink-0">●</span>
        <span className="font-medium truncate shrink-0 max-w-[28%]">{peerLabel}</span>
        <span className="truncate text-gray-700">{typeLabel}</span>
        <span className="text-gray-500 shrink-0">Ok</span>
        <span className="text-gray-500 truncate min-w-0 flex-1">{subject}</span>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded bg-white overflow-hidden ${className}`}>
      {/* Activity row — matches ATS-style expandable note rows */}
      <div className="flex items-stretch min-w-0 bg-gray-50/80 hover:bg-gray-50 border-b border-transparent data-[open=true]:border-gray-200">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse email" : "Expand email"}
          className="flex items-center justify-center w-8 shrink-0 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
        >
          {expanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
        </button>

        <div className="relative shrink-0" ref={actionsRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActionsOpen((o) => !o);
            }}
            className="h-full px-2 text-[11px] font-semibold tracking-wide text-blue-600 hover:text-blue-800 hover:bg-blue-50 uppercase"
          >
            Actions ▾
          </button>
          {actionsOpen ? (
            <div className="absolute left-0 top-full z-20 mt-0.5 min-w-[160px] rounded border border-gray-200 bg-white py-1 shadow-md">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setActionsOpen(false);
                  setExpanded(true);
                }}
              >
                Open email
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setActionsOpen(false);
                  void copyText(subject);
                }}
              >
                Copy subject
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setActionsOpen(false);
                  void copyText(peer || "");
                }}
              >
                Copy address
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-x-4 gap-y-1 min-w-0 px-2 py-2 text-left text-[13px] text-gray-800 flex-wrap sm:flex-nowrap"
        >
          <span className="shrink-0 tabular-nums text-gray-700 whitespace-nowrap w-[148px]">
            {whenLabel}
          </span>
          <span className="shrink-0 flex items-center gap-1.5 min-w-0 max-w-[180px]">
            <span className="text-gray-400 text-[10px]" aria-hidden>
              ●
            </span>
            <span className="font-medium truncate" title={peer || peerLabel}>
              {peerLabel}
            </span>
          </span>
          <span className="shrink-0 text-gray-800 whitespace-nowrap">{typeLabel}</span>
          <span className="shrink-0 text-gray-700">Ok</span>
          <span className="shrink-0 text-gray-600 hidden md:inline">Recruiting</span>
          <span
            className="min-w-0 flex-1 truncate text-gray-500 text-[12px]"
            title={subject}
          >
            {subject}
          </span>
        </button>
      </div>

      {expanded ? (
        <div className="bg-white">
          <div className="px-3 py-2.5 sm:px-4 border-b border-gray-100 bg-gray-50/50 space-y-1 text-xs sm:text-[13px]">
            <HeaderRow label="From" value={parsed.from || "—"} />
            <HeaderRow label="To" value={parsed.to || "—"} />
            {parsed.cc ? <HeaderRow label="Cc" value={parsed.cc} /> : null}
            <HeaderRow label="Subject" value={subject} strong />
            {parsed.when ? (
              <HeaderRow label="Date" value={formatWhenFull(parsed.when)} />
            ) : null}
          </div>
          <div className="px-3 py-3 sm:px-4">
            {!parsed.body ? (
              <p className="text-sm text-gray-400 italic">No message content</p>
            ) : (
              <>
                <p className="text-[11px] text-gray-400 mb-2 sm:hidden">
                  {bodyPeek(parsed.body, 80)}
                </p>
                <div className="max-h-72 overflow-y-auto overscroll-contain text-sm text-gray-800 whitespace-pre-wrap leading-relaxed wrap-break-word">
                  {parsed.body}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex gap-2 min-w-0">
      <span className="w-14 shrink-0 text-gray-500 font-medium">{label}</span>
      <span className={`min-w-0 wrap-break-word text-gray-800 ${strong ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

const OutlookEmailNoteBody = memo(OutlookEmailNoteBodyInner);
export default OutlookEmailNoteBody;
