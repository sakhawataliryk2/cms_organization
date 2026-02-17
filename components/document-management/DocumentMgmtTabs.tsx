"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function DocumentMgmtTabs() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useSearchParams() ?? new URLSearchParams();

  const basePath = "/dashboard/admin/document-management";
  const onSectionList =
    pathname === basePath || pathname === `${basePath}/`;
  const onPackets = pathname.includes("/document-management/packets");
  const onOnboarding = pathname.includes("/document-management/onboarding");
  const onOrganization = pathname.includes("/document-management/organization");

  const archived = params.get("archived") === "1";

  const goOnboarding = (nextArchived?: boolean) => {
    const q = new URLSearchParams(params.toString());
    if (typeof nextArchived === "boolean") {
      nextArchived ? q.set("archived", "1") : q.delete("archived");
    }
    const qs = q.toString();
    router.push(
      `/dashboard/admin/document-management/onboarding${qs ? `?${qs}` : ""}`
    );
  };

  const goOrganization = () => {
    router.push("/dashboard/admin/document-management/organization");
  };

  return (
    <div className="flex items-center gap-4 mb-4 border-b border-gray-200 pb-0">
      <button
        onClick={() => router.push("/dashboard/admin/document-management")}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
          onSectionList
            ? "text-blue-600 border-blue-600"
            : "text-gray-600 hover:text-gray-800 border-transparent"
        }`}
      >
        SECTIONS
      </button>

      <button
        onClick={() =>
          router.push("/dashboard/admin/document-management/packets")
        }
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
          onPackets
            ? "text-blue-600 border-blue-600"
            : "text-gray-600 hover:text-gray-800 border-transparent"
        }`}
      >
        PACKETS
      </button>

      <button
        onClick={() => goOnboarding()}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
          onOnboarding
            ? "text-blue-600 border-blue-600"
            : "text-gray-600 hover:text-gray-800 border-transparent"
        }`}
      >
        OnBoarding
      </button>

      <button
        onClick={goOrganization}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
          onOrganization
            ? "text-blue-600 border-blue-600"
            : "text-gray-600 hover:text-gray-800 border-transparent"
        }`}
      >
        Organization
      </button>

      {onOnboarding && (
        <button
          onClick={() => goOnboarding(!archived)}
          className={`ml-auto px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            archived
              ? "text-blue-600 border-blue-600"
              : "text-gray-600 hover:text-gray-800 border-transparent"
          }`}
        >
          {archived ? "SHOWING ARCHIVED" : "SHOW ARCHIVED"}
        </button>
      )}
    </div>
  );
}
