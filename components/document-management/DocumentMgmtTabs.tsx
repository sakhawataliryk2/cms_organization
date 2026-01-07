"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function DocumentMgmtTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onPackets = pathname.includes("/document-management/packets");
  const onDocs = !onPackets;

  // keep archived state in URL so it survives refresh + navigation
  const archived = params.get("archived") === "1";

  const goDocs = (nextArchived?: boolean) => {
    const q = new URLSearchParams(params.toString());
    if (typeof nextArchived === "boolean") {
      nextArchived ? q.set("archived", "1") : q.delete("archived");
    }
    const qs = q.toString();
    router.push(`/dashboard/admin/document-management${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="flex items-center gap-4 mb-4">
      <button
        onClick={() =>
          router.push("/dashboard/admin/document-management/packets")
        }
        className={`px-4 py-2 text-sm font-medium ${
          onPackets
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-gray-600 hover:text-gray-800"
        }`}
      >
        PACKETS
      </button>

      <button
        onClick={() => goDocs()}
        className={`px-4 py-2 text-sm font-medium ${
          onDocs
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-gray-600 hover:text-gray-800"
        }`}
      >
        DOCUMENTS
      </button>

      {/* Archived toggle should only show on Documents page */}
      {onDocs && (
        <button
          onClick={() => goDocs(!archived)}
          className={`px-4 py-2 text-sm font-medium ${
            archived
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          {archived ? "ARCHIVED" : "SHOW ARCHIVED"}
        </button>
      )}
    </div>
  );
}
