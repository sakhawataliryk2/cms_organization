"use client";

type JobSummaryCardProps = {
  job: {
    job_title?: string;
    jobTitle?: string;
    category?: string;
    organization_name?: string;
    organizationName?: string;
  };
  className?: string;
};

export default function JobSummaryCard({ job, className = "" }: JobSummaryCardProps) {
  const title = job.job_title ?? job.jobTitle ?? "Job";
  const category = job.category;
  const client = job.organization_name ?? job.organizationName;

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}
      role="region"
      aria-label="Selected job summary"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Selected job</p>
      <p className="font-semibold text-gray-900">{title}</p>
      {(category || client) && (
        <p className="text-sm text-gray-600 mt-1">
          {[category, client].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
