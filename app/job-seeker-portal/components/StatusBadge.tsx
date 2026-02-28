// app/job-seeker-portal/components/StatusBadge.tsx
export default function StatusBadge({ status }: { status: string | null | undefined }) {
  // Check if the status is a valid string
  const statusText = typeof status === "string" ? status.toUpperCase() : "UNKNOWN";

  const isSent = statusText === "SENT";

  return (
    <span
      className={`text-xs font-semibold ${
        isSent ? "text-blue-700" : "text-gray-600"
      }`}
    >
      {statusText}
    </span>
  );
}