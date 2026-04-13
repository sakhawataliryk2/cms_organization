"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { FiDownload, FiFilter, FiArrowLeft } from "react-icons/fi";

const STATUS_OPTIONS = [
  { value: "", label: "Default (Active / Open only)" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All statuses" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "contract", label: "Contract" },
  { value: "direct-hire", label: "Direct Hire" },
  { value: "executive-search", label: "Executive Search" },
];

export default function JobsXMLFeedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [jobType, setJobType] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGoBack = () => {
    router.push("/dashboard/admin");
  };

  const handleGenerateFeed = () => {
    try {
      setIsGenerating(true);

      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (jobType) params.set("type", jobType);

      const query = params.toString();
      const url = `/api/jobs/xml${query ? `?${query}` : ""}`;

      // Open XML feed in new tab so it can be copied or consumed by job boards
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gray-200 min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Jobs XML Feed</h1>
            <p className="text-sm text-gray-600 mt-1">
              Generate an XML feed of your jobs for external job boards and integrations.
            </p>
          </div>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-100"
          >
            <FiArrowLeft className="h-4 w-4" />
            <span>Back to Admin Center</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">Feed Filters</h2>
          </div>

          <p className="text-sm text-gray-600">
            Use these filters to control which jobs are included in the XML feed. If you leave a filter
            empty, the default behavior will be used.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Job Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || "default"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Default: only jobs marked as active/open are included.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Job Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all-types"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Filter by internal job type if you use categories like Contract, Direct Hire, etc.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleGenerateFeed}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <FiDownload className="h-4 w-4" />
              <span>{isGenerating ? "Generating..." : "Open XML Feed"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

