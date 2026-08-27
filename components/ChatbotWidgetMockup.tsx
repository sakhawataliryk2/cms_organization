"use client";

import { useMemo, useState } from "react";
import { FiMessageCircle, FiSend, FiX, FiMinimize2 } from "react-icons/fi";

export type ChatbotWidgetMockupProps = {
  siteLabel?: string;
  companyName?: string;
  className?: string;
};

const DEFAULT_GREETING =
  "Hi there! I'm your Complete Staffing assistant. Ask about open roles, hiring support, or how we can help your team.";

export default function ChatbotWidgetMockup({
  siteLabel,
  companyName,
  className = "",
}: ChatbotWidgetMockupProps) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");

  const title = useMemo(() => {
    if (companyName?.trim()) return `${companyName.trim()} Assistant`;
    if (siteLabel?.trim()) return "Site Assistant";
    return "CSS Assistant";
  }, [companyName, siteLabel]);

  const subtitle = siteLabel?.trim() || "Complete Staffing Solutions";

  if (!open) {
    return (
      <div className={`fixed bottom-6 right-6 z-[9999] ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:scale-105"
          aria-label="Open chat"
        >
          <FiMessageCircle size={24} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ${className}`}
    >
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-blue-100">{subtitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1.5 hover:bg-white/15"
            aria-label="Minimize chat"
          >
            <FiMinimize2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1.5 hover:bg-white/15"
            aria-label="Close chat"
          >
            <FiX size={16} />
          </button>
        </div>
      </div>

      <div className="flex max-h-72 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 px-4 py-4">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-gray-100">
          {DEFAULT_GREETING}
        </div>
        <div className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2 text-sm text-white">
          What contract staffing options do you offer?
        </div>
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-gray-100">
          We place skilled professionals across IT, finance, healthcare, and more —
          temp, temp-to-hire, and direct hire. Want me to connect you with a recruiter?
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            className="rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <FiSend size={14} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          Mockup widget · not connected to live AI
        </p>
      </div>
    </div>
  );
}
