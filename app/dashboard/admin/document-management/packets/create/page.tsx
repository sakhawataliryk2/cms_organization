"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiChevronUp, FiChevronDown, FiX } from "react-icons/fi";

type Document = {
  id: number;
  document_name: string;
  category: string;
};

export default function CreatePacketPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [packetName, setPacketName] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState("");

  const [selectedDocs, setSelectedDocs] = useState<Document[]>([]);

  // -------------------------
  // Fetch documents (left list)
  // -------------------------
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/template-documents", { cache: "no-store" });
      const data = await res.json();

      const list: Document[] =
        data?.documents ||
        data?.data ||
        (Array.isArray(data) ? data : []) ||
        [];

      setDocs(list);
    } catch (e) {
      console.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // -------------------------
  // Filter documents
  // -------------------------
  const filteredDocs = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter((d) => d.document_name.toLowerCase().includes(q));
  }, [docs, search]);

  // -------------------------
  // Add document to packet
  // -------------------------
  const addDoc = (doc: Document) => {
    if (selectedDocs.find((d) => d.id === doc.id)) return;
    setSelectedDocs((prev) => [...prev, doc]);
  };

  // -------------------------
  // Remove document
  // -------------------------
  const removeDoc = (id: number) => {
    setSelectedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // -------------------------
  // Reorder docs
  // -------------------------
  const moveDoc = (index: number, dir: "up" | "down") => {
    setSelectedDocs((prev) => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // -------------------------
  // Save packet
  // -------------------------
  const savePacket = async () => {
    if (!packetName.trim()) {
      alert("Packet name is required");
      return;
    }

    if (selectedDocs.length === 0) {
      alert("Please select at least one document");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        packet_name: packetName,
        documents: selectedDocs.map((d, i) => ({
          document_id: d.id,
          sort_order: i + 1,
        })),
      };

      const res = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to create packet");
      }

      router.push("/dashboard/admin/document-management/packets");
    } catch (e: any) {
      alert(e.message || "Create failed");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="bg-gray-200 min-h-screen p-4">
      <div className="bg-white rounded shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#111] text-white px-4 py-3 flex justify-between items-center">
          <div className="text-sm font-semibold">Create Packet</div>
          <button
            onClick={() => router.back()}
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Packet name */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              PACKET NAME <span className="text-red-500">*</span>
            </label>
            <input
              value={packetName}
              onChange={(e) => setPacketName(e.target.value)}
              className="w-full h-9 px-3 border border-gray-400 text-sm outline-none"
              placeholder="Enter packet name"
            />
          </div>

          {/* Content */}
          <div className="grid grid-cols-12 gap-4 min-h-[420px]">
            {/* LEFT: Documents */}
            <div className="col-span-5 border rounded">
              <div className="p-3 border-b font-semibold text-sm">
                Add Documents to Packet
              </div>

              <div className="p-3">
                <div className="relative mb-2">
                  <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter Documents..."
                    className="w-full pl-8 pr-2 py-1.5 border text-sm"
                  />
                </div>

                <div className="max-h-[320px] overflow-y-auto">
                  {filteredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => addDoc(doc)}
                      className="w-full text-left px-2 py-2 text-sm hover:bg-gray-100 border-b"
                    >
                      {doc.document_name}
                      <div className="text-xs text-gray-500">
                        {doc.category}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Selected docs */}
            <div className="col-span-7 border rounded bg-gray-50">
              <div className="p-3 border-b font-semibold text-sm">
                Documents in Packet ({selectedDocs.length})
              </div>

              {selectedDocs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  Select documents to add to this Packet
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {selectedDocs.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 bg-white border p-2"
                    >
                      <div className="flex-1 text-sm">{doc.document_name}</div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => moveDoc(index, "up")}
                          className="p-1 border rounded"
                        >
                          <FiChevronUp />
                        </button>
                        <button
                          onClick={() => moveDoc(index, "down")}
                          className="p-1 border rounded"
                        >
                          <FiChevronDown />
                        </button>
                        <button
                          onClick={() => removeDoc(doc.id)}
                          className="p-1 border rounded text-red-600"
                        >
                          <FiX />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 border rounded text-sm"
            >
              Cancel
            </button>
            <button
              onClick={savePacket}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
