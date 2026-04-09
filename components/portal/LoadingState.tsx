"use client";

export default function LoadingState({ text = "Loading..." }: { text?: string }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">{text}</div>;
}

