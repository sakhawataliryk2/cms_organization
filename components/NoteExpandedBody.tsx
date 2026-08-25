"use client";

import type { ReactNode } from "react";
import { useRouter } from "nextjs-toploader/app";
import OutlookEmailNoteBody, { isOutlookEmailNote } from "@/components/OutlookEmailNoteBody";
import ZoomInfoNoteBody, { isZoomInfoNote } from "@/components/ZoomInfoNoteBody";
import ZoomPhoneNoteBody from "@/components/ZoomPhoneNoteBody";

function parseAboutReferences(refs: unknown): any[] {
  if (!refs) return [];
  if (typeof refs === "string") {
    try {
      const parsed = JSON.parse(refs);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(refs) ? refs : [];
}

type NoteExpandedBodyProps = {
  note: {
    id?: string | number;
    action?: string | null;
    note_type?: string | null;
    text?: string | null;
    about?: unknown;
    about_references?: unknown;
    aboutReferences?: unknown;
  };
  /** Override default Zoom / Outlook / ZoomInfo body (e.g. NoteRichText). */
  body?: ReactNode;
  additionalReferencesText?: string | null;
};

export default function NoteExpandedBody({
  note,
  body,
  additionalReferencesText,
}: NoteExpandedBodyProps) {
  const router = useRouter();
  const aboutRefs = parseAboutReferences(
    note.about_references ?? note.aboutReferences ?? note.about
  );
  const outlookEmail = isOutlookEmailNote(note.action, note.note_type, note.text);
  const zoomInfoNote = isZoomInfoNote(note.action, note.note_type, note.text);

  const navigateToRef = (r: any) => {
    if (!r?.id || !r?.type) return;
    const t = String(r.type || "").toLowerCase().replace(/\s+/g, "");
    const routeMap: Record<string, string> = {
      organization: `/dashboard/organizations/view?id=${r.id}`,
      job: `/dashboard/jobs/view?id=${r.id}`,
      jobseeker: `/dashboard/job-seekers/view?id=${r.id}`,
      lead: `/dashboard/leads/view?id=${r.id}`,
      task: `/dashboard/tasks/view?id=${r.id}`,
      placement: `/dashboard/placements/view?id=${r.id}`,
      hiringmanager: `/dashboard/hiring-managers/view?id=${r.id}`,
    };
    if (routeMap[t]) router.push(routeMap[t]);
  };

  return (
    <div className="space-y-3">
      {aboutRefs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {aboutRefs.map((ref: any, idx: number) => {
            const displayText =
              typeof ref === "string"
                ? ref
                : ref.display || ref.value || `${ref.type} #${ref.id}`;
            const refId = typeof ref === "string" ? null : ref.id;
            const refType = typeof ref === "string" ? null : ref.type;
            const isClickable = !!(refId && refType);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => isClickable && navigateToRef(ref)}
                disabled={!isClickable}
                className={`inline-flex items-center text-xs px-2.5 py-1 rounded border ${
                  isClickable
                    ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                }`}
              >
                {displayText}
              </button>
            );
          })}
        </div>
      )}
      {additionalReferencesText && aboutRefs.length === 0 && (
        <div className="text-xs text-gray-600">References: {additionalReferencesText}</div>
      )}
      {body ??
        (outlookEmail ? (
          <OutlookEmailNoteBody text={note.text} />
        ) : zoomInfoNote ? (
          <ZoomInfoNoteBody text={note.text} />
        ) : (
          <ZoomPhoneNoteBody text={note.text} note={note} />
        ))}
    </div>
  );
}
