"use client";

import RecordNameResolver from "@/components/RecordNameResolver";

type JobSummaryCardProps = {
  job: {
    company_name?: number;
    organization_id?: number;
    id?: number;
    job_title?: string;
    record_number?: string;
    jobTitle?: string;
    category?: string;
    organization_name?: string;
    organizationName?: string;
  };
  className?: string;
};

export default function JobSummaryCard({ job, className = "" }: JobSummaryCardProps) {
  const organizationID = job.organization_id || job.company_name;
  const client = job.organization_name ?? job.organizationName;

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}
      role="region"
      aria-label="Selected job summary"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Selected job</p>
      <p className="font-semibold text-gray-900">
        <RecordNameResolver id={job.id} type="job" clickable={true} />
      </p>
      {(organizationID || client) && (
        <p className="text-sm text-gray-600 mt-1">
          <RecordNameResolver id={organizationID} type="organization" clickable={true} />
        </p>
      )}
    </div>
  );
}
