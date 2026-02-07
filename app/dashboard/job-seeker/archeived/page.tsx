"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect from /dashboard/job-seeker/archeived (typo path)
 * to /dashboard/job-seekers/archived
 */
export default function ArcheivedJobSeekersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/job-seekers/archived");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px] text-gray-500">
      Redirecting to archived job seekers...
    </div>
  );
}
