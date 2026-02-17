// app/dashboard/placements/add/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

/** Map job_type from API to placement add segment (URL path). */
function jobTypeToPlacementSegment(jobType: string): string {
  const t = String(jobType || "").toLowerCase().replace(/\s+/g, "-");
  if (t.includes("direct")) return "direct-hire";
  if (t.includes("executive")) return "executive-search";
  return "contract";
}

/** Whether the job type is recognized for placements. */
function isKnownJobType(jobType: string): boolean {
  const t = String(jobType || "").toLowerCase();
  return t.includes("direct") || t.includes("executive") || t.includes("contract") || t === "";
}

type JobItem = {
  id: number | string;
  job_title?: string;
  jobTitle?: string;
  job_type?: string;
  jobType?: string;
  category?: string;
  organization_name?: string;
  organizationName?: string;
  status?: string;
};

interface JobSearchSelectOption {
  id: string;
  name: string;
  sub?: string;
}

interface JobSearchSelectProps {
  value: string;
  options: JobSearchSelectOption[];
  onChange: (id: string, opt: JobSearchSelectOption) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  disabled?: boolean;
}

function JobSearchSelect({
  value,
  options,
  onChange,
  placeholder = "Search or select Job",
  loading = false,
  className = "",
  disabled = false,
}: JobSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => String(o.id) === value);
  const displayValue = selectedOption ? (selectedOption.sub ? `${selectedOption.name} · ${selectedOption.sub}` : selectedOption.name) : "";

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const nameMatch = (opt.name || "").toLowerCase().includes(q);
      const subMatch = (opt.sub || "").toLowerCase().includes(q);
      return nameMatch || subMatch;
    });
  }, [search, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [search, isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, isOpen]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filteredOptions[highlightIndex];
      if (opt) {
        onChange(opt.id, opt);
        setIsOpen(false);
        setSearch("");
      }
    }
  };

  const handleSelect = (opt: JobSearchSelectOption) => {
    onChange(opt.id, opt);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        className={`w-full p-2 border-b border-gray-300 focus-within:border-blue-500 flex items-center gap-2 bg-white ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
      >
        <input
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={displayValue ? "" : placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 outline-none bg-transparent"
          autoComplete="off"
        />
      </div>
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-sm max-h-56 overflow-auto"
        >
          {loading ? (
            <p className="px-3 py-4 text-sm text-gray-500 mt-1">Loading...</p>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No jobs match your search
            </div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                data-index={idx}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 ${idx === highlightIndex ? "bg-blue-50" : ""} ${String(opt.id) === value ? "font-medium text-blue-700" : ""}`}
              >
                <span className="block">{opt.name}</span>
                {opt.sub && <span className="block text-xs text-gray-500 mt-0.5">{opt.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AddPlacementLanding() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // Edit mode: id = placement id → fetch placement and redirect by placement_type
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const redirectForEdit = async () => {
      try {
        const res = await fetch(`/api/placements/${id}`);
        if (!res.ok) {
          router.replace(`/dashboard/placements/add/contract?id=${id}`);
          return;
        }
        const data = await res.json();
        const type = String(data?.placement?.placement_type || "").toLowerCase();
        let segment = "contract";
        if (type.includes("direct")) segment = "direct-hire";
        else if (type.includes("executive")) segment = "executive-search";
        router.replace(`/dashboard/placements/add/${segment}?id=${id}`);
      } catch {
        router.replace(`/dashboard/placements/add/contract?id=${id}`);
      }
    };
    redirectForEdit();
  }, [searchParams, router]);

  // Fetch jobs for job-first add flow (when no placement id)
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) return;
    const load = async () => {
      setJobsLoading(true);
      setSelectError(null);
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) {
          setSelectError("Failed to load jobs.");
          return;
        }
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch {
        setSelectError("Failed to load jobs.");
      } finally {
        setJobsLoading(false);
      }
    };
    load();
  }, [searchParams]);

  const jobOptions = useMemo((): JobSearchSelectOption[] => {
    return jobs.map((job) => {
      const id = String(job.id);
      const name = job.job_title ?? job.jobTitle ?? "Untitled Job";
      const org = job.organization_name ?? job.organizationName ?? "";
      const sub = [job.category, org].filter(Boolean).join(" · ");
      return { id, name, sub: sub || undefined };
    });
  }, [jobs]);

  const handleJobSelect = async (jobId: string) => {
    if (!jobId) return;
    setSelectError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setSelectError("Could not load job details. Please try another job.");
        return;
      }
      const data = await res.json();
      const job = data.job;
      const jobType = job?.job_type ?? job?.jobType ?? "";
      if (!isKnownJobType(jobType) && jobType !== "") {
        setSelectError(
          "This job's type is not configured for placements. Please choose another job or contact your administrator."
        );
        return;
      }
      const segment = jobTypeToPlacementSegment(jobType);
      router.push(`/dashboard/placements/add/${segment}?jobId=${jobId}`);
    } catch {
      setSelectError("Could not load job details. Please try again.");
    }
  };

  const handleContinue = () => {
    if (selectedJobId) handleJobSelect(selectedJobId);
  };

  const handleGoBack = () => {
    router.back();
  };

  // When in edit mode (id present), we redirect in useEffect; show minimal UI until redirect
  const placementId = searchParams.get("id");
  if (placementId) {
    return (
      <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
            <div className="flex items-center">
              <div className="bg-red-100 border border-red-300 p-2 mr-3">
                <Image src="/window.svg" alt="Placement" width={24} height={24} className="text-red-600" />
              </div>
              <h1 className="text-xl font-bold">Add Placement</h1>
            </div>
          </div>
          <p className="text-gray-600">Loading placement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
          <div className="flex items-center">
            <div className="bg-red-100 border border-red-300 p-2 mr-3">
              <Image src="/window.svg" alt="Placement" width={24} height={24} className="text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Add Placement</h1>
          </div>
          <button
            onClick={handleGoBack}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            X
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600 font-medium">
            Select a job to add a placement. The placement type will be set automatically based on the job type.
          </p>
          {selectError && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {selectError}
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="w-48 font-medium shrink-0">Job:</label>
            <div className="flex-1">
              <JobSearchSelect
                value={selectedJobId}
                options={jobOptions}
                onChange={(id) => setSelectedJobId(id)}
                placeholder="Search or select Job"
                loading={jobsLoading}
              />
            </div>
          </div>
          {jobs.length === 0 && !jobsLoading && (
            <p className="text-gray-500 text-sm">No jobs available. Create a job first to add a placement.</p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedJobId.trim()}
              onClick={handleContinue}
              className={`px-4 py-2 rounded text-white ${!selectedJobId.trim() ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
