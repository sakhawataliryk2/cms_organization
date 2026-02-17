"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiRefreshCw, FiArrowLeft } from "react-icons/fi";
import DocumentMgmtTabs from "@/components/document-management/DocumentMgmtTabs";

type Packet = {
  id: number;
  packet_name?: string;
  name?: string;
  documents_count?: number;
  doc_count?: number;
};

export default function PacketsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [search, setSearch] = useState("");

  const fetchPackets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/packets", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to load packets");
      }

      // handle any backend shape:
      const list: Packet[] =
        data?.packets || data?.data || (Array.isArray(data) ? data : []) || [];

      setPackets(list);
    } catch (e: any) {
      console.error("Packets load failed:", e?.message);
      setPackets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPackets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packets;

    return packets.filter((p) => {
      const name = (p.packet_name || p.name || "").toLowerCase();
      return name.includes(q);
    });
  }, [packets, search]);

  return (
    <div className="bg-gray-200 min-h-screen p-4">
      <button
        onClick={() => router.push("/dashboard/admin/document-management")}
        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-4"
      >
        <FiArrowLeft className="w-5 h-5" />
        Back to Document Management
      </button>
      <DocumentMgmtTabs />
      {/* Header */}
      <div className="bg-white rounded shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packets..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                router.push(
                  "/dashboard/admin/document-management/packets/create"
                )
              }
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              CREATE NEW PACKET
            </button>

            <button
              onClick={fetchPackets}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50"
              title="Refresh"
              disabled={loading}
            >
              <FiRefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Packet Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Documents
              </th>
              <th className="px-6 py-3 w-32"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-6 text-sm text-gray-600">
                  Loading packets...
                </td>
              </tr>
            ) : filteredPackets.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-6 text-sm text-gray-600">
                  No packets found.
                </td>
              </tr>
            ) : (
              filteredPackets.map((p) => {
                const name = p.packet_name || p.name || "Untitled Packet";
                const count = p.documents_count ?? p.doc_count ?? 0;

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/admin/document-management/packets/${p.id}`
                      )
                    }
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {name}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-700">{count}</td>

                    <td className="px-6 py-4 text-right">
                      <span className="text-xs text-blue-600 underline">
                        Open
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
