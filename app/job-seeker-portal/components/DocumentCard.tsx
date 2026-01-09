// app/job-seeker-portal/components/DocumentCard.tsx
"use client";

import StatusBadge from "./StatusBadge";

type Props = {
  status: string;
  title: string;
  subtitle?: string;
  attachments?: number;

  onAttach?: () => void;
  onCreateAndSubmit?: () => void;
  onView?: () => void;
};

export default function DocumentCard({
  status,
  title,
  subtitle,
  attachments = 0,
  onAttach,
  onCreateAndSubmit,
  onView,
}: Props) {
  return (
    <div className="bg-white rounded border border-gray-300 shadow-sm">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />

          <button
            onClick={onView}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            VIEW ▾
          </button>
        </div>

        <div className="mt-2 font-semibold text-gray-800">{title}</div>
        {subtitle ? (
          <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
        ) : null}

        <div className="text-xs text-gray-500 mt-3">{attachments} Attachment(s)</div>
      </div>

      <div className="border-t border-gray-200 grid grid-cols-2">
        <button
          onClick={onAttach}
          className="py-3 text-sm font-semibold text-blue-700 hover:bg-gray-50 border-r border-gray-200"
        >
          ⬆ ATTACH
        </button>
        <button
          onClick={onCreateAndSubmit}
          className="py-3 text-sm font-semibold text-blue-700 hover:bg-gray-50"
        >
          ✎ CREATE AND SUBMIT
        </button>
      </div>
    </div>
  );
}
