"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiRefreshCw } from "react-icons/fi";

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
      {/* Header / Tabs style area (optional) */}
      <div className="bg-white rounded shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter Packets..."
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

      {/* List + Right panel layout like screenshot */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 min-h-[620px]">
          {/* Left list */}
          <div className="col-span-4 border-r bg-gray-50">
            {loading ? (
              <div className="p-6 text-sm text-gray-600">Loading...</div>
            ) : filteredPackets.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">
                No packets created.
              </div>
            ) : (
              filteredPackets.map((p) => {
                const name = p.packet_name || p.name || "Untitled Packet";
                const count = p.documents_count ?? p.doc_count ?? 0;

                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      router.push(
                        `/dashboard/admin/document-management/packets/${p.id}`
                      )
                    }
                    className="w-full text-left px-4 py-3 border-b hover:bg-white"
                  >
                    <div className="text-sm font-semibold text-gray-800">
                      {name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({count} Documents)
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right empty panel */}
          <div className="col-span-8 bg-gray-100 p-6">
            <div className="text-sm text-gray-600">
              Select a packet from the left to view and edit its documents.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
