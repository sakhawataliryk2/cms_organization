"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function DocumentMgmtTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onPackets = pathname.includes("/document-management/packets");
  const onOrganizations = params.get("tab") === "organizations";
  const onDocs = !onPackets && !onOrganizations;

  // keep archived state in URL so it survives refresh + navigation
  const archived = params.get("archived") === "1";

  const goDocs = (nextArchived?: boolean) => {
    const q = new URLSearchParams(params.toString());
    q.delete("tab");
    if (typeof nextArchived === "boolean") {
      nextArchived ? q.set("archived", "1") : q.delete("archived");
    }
    const qs = q.toString();
    router.push(`/dashboard/admin/document-management${qs ? `?${qs}` : ""}`);
  };

  const goOrganizations = () => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", "organizations");
    q.delete("archived");
    router.push(`/dashboard/admin/document-management?${q.toString()}`);
  };

  return (
    <div className="flex items-center gap-4 mb-4 border-b border-gray-200 pb-0">
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
        onClick={() => goDocs()}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
          onDocs
            ? "text-blue-600 border-blue-600"
            : "text-gray-600 hover:text-gray-800 border-transparent"
        }`}
      >
        DOCUMENTS
      </button>

      <button
        onClick={goOrganizations}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
          onOrganizations
            ? "text-blue-600 border-blue-600"
            : "text-gray-600 hover:text-gray-800 border-transparent"
        }`}
      >
        ORGANIZATIONS
      </button>

      {/* Archived toggle - only show on Documents tab */}
      {onDocs && (
        <button
          onClick={() => goDocs(!archived)}
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
