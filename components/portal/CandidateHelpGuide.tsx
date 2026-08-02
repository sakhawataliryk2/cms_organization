"use client";

import { useState } from "react";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

const STEPS = [
  {
    title: "Welcome to the Candidate Portal",
    body: "Use this portal to submit weekly timesheets, complete documents, and manage your profile. Start from the tabs below the header.",
  },
  {
    title: "Active Placement",
    body: "Your active Contract placement appears in the header. If you have more than one, click it to switch. Timesheets are only available for Contract placements.",
  },
  {
    title: "Timesheets — Did you work?",
    body: "Each week you will be asked if you worked. Choose Yes to enter daily hours, or No to submit zero hours for the week (approved automatically).",
  },
  {
    title: "Entering hours",
    body: "On the weekly entry page, fill Time In, Time Out, and Lunch for each day. Totals calculate automatically and your draft saves as you type. Click Submit Timesheet when finished.",
  },
  {
    title: "Documents",
    body: "Open the Documents tab to view, fill, sign, and attach onboarding or shared documents assigned to you.",
  },
  {
    title: "Profile & Help",
    body: "Use the profile icon to review your information. Reopen this guide anytime with the Help icon.",
  },
];

export default function CandidateHelpGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-guide-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Help guide · Step {step + 1} of {STEPS.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close help"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="px-5 py-6">
          <h2 id="help-guide-title" className="text-lg font-semibold text-slate-900">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{current.body}</p>

          <div className="mt-6 flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i === step ? "bg-blue-600" : "bg-slate-200"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
          >
            <FiChevronLeft size={16} /> Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => {
                setStep(0);
                onClose();
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Next <FiChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
