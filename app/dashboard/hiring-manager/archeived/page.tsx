"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect from /dashboard/hiring-manager/archeived (typo path)
 * to /dashboard/hiring-managers/archived
 */
export default function ArcheivedHiringManagersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/hiring-managers/archived");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px] text-gray-500">
      Redirecting to archived hiring managers...
    </div>
  );
}
