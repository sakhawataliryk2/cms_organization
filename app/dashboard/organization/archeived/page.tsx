"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect from /dashboard/organization/archeived (typo path)
 * to /dashboard/organizations/archived
 */
export default function ArcheivedRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/organizations/archived");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px] text-gray-500">
      Redirecting to archived organizations...
    </div>
  );
}
