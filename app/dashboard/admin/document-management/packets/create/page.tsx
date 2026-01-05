"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiChevronRight, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import { TbGripVertical } from "react-icons/tb";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Document = {
  id: number;
  document_name: string;
  category: string;
};

export default function CreatePacketPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // left list
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState("");

  // packet
  const [packetName, setPacketName] = useState("");
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
      console.error("Failed to load documents", e);
      setDocs([]);
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
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      (d.document_name || "").toLowerCase().includes(q)
    );
  }, [docs, search]);

  // -------------------------
  // Add doc -> selected list
  // -------------------------
  const addDoc = (doc: Document) => {
    if (selectedDocs.some((d) => d.id === doc.id)) return;
    setSelectedDocs((prev) => [...prev, doc]);
  };

  // -------------------------
  // Remove selected doc
  // -------------------------
  const removeDoc = (id: number) => {
    setSelectedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // -------------------------
  // DND reorder (right list)
  // -------------------------
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    setSelectedDocs((prev) => {
      const oldIndex = prev.findIndex(
        (d) => String(d.id) === String(active.id)
      );
      const newIndex = prev.findIndex((d) => String(d.id) === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
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
        packet_name: packetName.trim(),
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
      alert(e?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-200 min-h-screen p-4">
      <div className="bg-white rounded shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#111] text-white px-4 py-3 flex justify-between items-center">
          <div className="text-sm font-semibold">Create Packet</div>

          <button
            type="button"
            onClick={() => router.back()}
            className="text-white/70 hover:text-white"
            title="Close"
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
            <div className="col-span-5 border rounded bg-white">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-semibold text-sm">
                  Add Documents to Packet
                </div>

                <button
                  type="button"
                  onClick={fetchDocuments}
                  className="p-2 border border-gray-300 rounded hover:bg-gray-50"
                  title="Refresh"
                  disabled={loading}
                >
                  <FiRefreshCw className="w-4 h-4 text-gray-700" />
                </button>
              </div>

              <div className="p-3">
                <div className="relative mb-2">
                  <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter Documents..."
                    className="w-full pl-8 pr-2 py-2 border text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-[340px] overflow-y-auto border">
                  {loading ? (
                    <div className="p-3 text-sm text-gray-600">Loading...</div>
                  ) : filteredDocs.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">
                      No documents found.
                    </div>
                  ) : (
                    filteredDocs.map((doc) => {
                      const already = selectedDocs.some((d) => d.id === doc.id);

                      return (
                        <button
                          type="button"
                          key={doc.id}
                          onClick={() => addDoc(doc)}
                          disabled={already}
                          className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 flex items-center justify-between
                            ${
                              already
                                ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-100"
                            }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {doc.document_name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {doc.category}
                            </div>
                          </div>

                          {!already && (
                            <FiChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Selected docs + DND */}
            <div className="col-span-7 border rounded bg-gray-50">
              <div className="p-3 border-b font-semibold text-sm">
                Documents in Packet ({selectedDocs.length})
              </div>

              {selectedDocs.length === 0 ? (
                <div className="h-[360px] flex items-center justify-center text-sm text-gray-500">
                  Select documents to add to this Packet
                </div>
              ) : (
                <div className="p-3">
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={selectedDocs.map((d) => String(d.id))}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {selectedDocs.map((doc, index) => (
                          <SortableRow
                            key={doc.id}
                            id={String(doc.id)}
                            index={index}
                            title={doc.document_name}
                            subtitle={doc.category}
                            onRemove={() => removeDoc(doc.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border rounded text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={savePacket}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
            >
              {loading ? "Saving..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableRow({
  id,
  index,
  title,
  subtitle,
  onRemove,
}: {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border p-2"
    >
      {/* drag handle */}
      <button
        type="button"
        className="p-1 border rounded bg-gray-50 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <TbGripVertical className="w-5 h-5 text-gray-600" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {index + 1}. {title}
        </div>
        <div className="text-xs text-gray-500 truncate">{subtitle}</div>
      </div>

      {/* remove */}
      <button
        type="button"
        onClick={onRemove}
        className="p-2 border rounded text-red-600 hover:bg-red-50"
        title="Remove"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
}
