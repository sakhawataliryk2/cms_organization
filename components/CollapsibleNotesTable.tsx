"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FiChevronRight } from "react-icons/fi";
import { noteCommentPreview } from "@/lib/notePreview";

export type CollapsibleNoteRow = {
  id: string | number;
  date: string;
  author: string;
  action: string;
  text?: string | null;
};

type CollapsibleNotesTableProps<T> = {
  notes: T[];
  getRow: (note: T) => CollapsibleNoteRow;
  renderExpanded: (note: T) => ReactNode;
  emptyMessage?: string;
};

export default function CollapsibleNotesTable<T>({
  notes,
  getRow,
  renderExpanded,
  emptyMessage = "No notes have been added yet.",
}: CollapsibleNotesTableProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const match = hash.match(/^note-(.+)$/);
    if (!match) return;
    setExpandedIds((prev) => new Set(prev).add(match[1]));
  }, []);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!notes.length) {
    return <p className="text-gray-500 italic">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="w-8 px-2 py-2" aria-label="Expand" />
            <th className="px-3 py-2 whitespace-nowrap">Date Added</th>
            <th className="px-3 py-2 whitespace-nowrap">Author</th>
            <th className="px-3 py-2 whitespace-nowrap">Action</th>
            <th className="px-3 py-2">Comments</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => {
            const row = getRow(note);
            const id = String(row.id);
            const expanded = expandedIds.has(id);
            const preview = noteCommentPreview(row.text);
            return (
              <FragmentRow
                key={id}
                id={id}
                expanded={expanded}
                onToggle={() => toggle(id)}
                date={row.date}
                author={row.author}
                action={row.action}
                preview={preview}
              >
                {renderExpanded(note)}
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({
  id,
  expanded,
  onToggle,
  date,
  author,
  action,
  preview,
  children,
}: {
  id: string;
  expanded: boolean;
  onToggle: () => void;
  date: string;
  author: string;
  action: string;
  preview: string;
  children: ReactNode;
}) {
  return (
    <>
      <tr
        id={`note-${id}`}
        className="border-t border-gray-200 bg-white hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-2 py-2 align-middle text-gray-500">
          <FiChevronRight
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          />
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{date}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-800">{author}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-800">{action || "—"}</td>
        <td className="px-3 py-2 text-gray-600 max-w-xl">
          {preview ? (
            <span className="line-clamp-1">{preview}</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            {children}
          </td>
        </tr>
      )}
    </>
  );
}
