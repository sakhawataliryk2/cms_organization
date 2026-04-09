"use client";

export default function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{text}</div>;
}

