"use client";

import Link from "next/link";
import {
  noteReferencePayload,
  parseNoteAboutReferences,
  parseNoteTextParts,
  truncateNoteTextParts,
} from "@/lib/noteMentions";

type NoteRichTextProps = {
  text: string | null | undefined;
  references?: unknown;
  note?: unknown;
  compact?: boolean;
  maxChars?: number;
  className?: string;
};

export default function NoteRichText({
  text,
  references,
  note,
  compact = false,
  maxChars,
  className,
}: NoteRichTextProps) {
  const raw = text ?? "";
  const refs = parseNoteAboutReferences(
    references ?? noteReferencePayload(note),
  );
  const parsed = parseNoteTextParts(raw, refs);
  const parts =
    compact && !maxChars
      ? truncateNoteTextParts(parsed, 100)
      : maxChars
        ? truncateNoteTextParts(parsed, maxChars)
        : parsed;

  const cls =
    className ||
    (compact
      ? "text-sm text-gray-700 whitespace-pre-wrap"
      : "text-gray-700 whitespace-pre-wrap leading-relaxed");

  if (!parts.length) {
    return <p className={cls}>{raw}</p>;
  }

  return (
    <p className={cls}>
      {parts.map((part, index) => {
        if (part.kind === "text") return <span key={index}>{part.text}</span>;
        return (
          <Link
            key={`${part.type}:${part.id}:${index}`}
            href={part.href}
            title={`Open ${part.type}`}
            className="inline font-medium text-blue-700 hover:text-blue-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            #{part.label}
          </Link>
        );
      })}
    </p>
  );
}
