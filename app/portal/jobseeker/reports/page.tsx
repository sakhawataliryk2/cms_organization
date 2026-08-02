"use client";

import { FiBarChart2 } from "react-icons/fi";

export default function ReportsComingSoonPage() {
  return (
    <div className="rounded-lg border border-[#d8dde3] bg-white px-6 py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f1fb] text-[#1a6bb5]">
          <FiBarChart2 size={30} strokeWidth={1.5} />
        </div>
        <h1 className="text-[18px] font-semibold text-[#1a1a1a]">Reports Coming Soon</h1>
        <p className="mt-2 text-[14px] text-[#7a8490]">
          Reporting features will be available in a future update.
        </p>
      </div>
    </div>
  );
}
