"use client";

const COLOR_MAP: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  done: "bg-green-100 text-green-800",
};

export default function StatusPill({ value }: { value?: string | null }) {
  const key = String(value || "").toLowerCase().trim();
  const cls = COLOR_MAP[key] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {value || "N/A"}
    </span>
  );
}

