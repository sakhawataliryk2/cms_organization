// app/job-seeker-portal/components/StatusBadge.tsx
export default function StatusBadge({ status }: { status: string }) {
  const isSent = status.toUpperCase() === "SENT";

  return (
    <span
      className={`text-xs font-semibold ${
        isSent ? "text-blue-700" : "text-gray-600"
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}
