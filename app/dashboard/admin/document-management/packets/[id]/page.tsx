"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
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

type Doc = { id: number; document_name: string; category: string };

type PacketDoc = {
  document_id: number;
  sort_order: number;
  document_name?: string;
  category?: string;
};

type Packet = { id: number; packet_name: string; documents?: PacketDoc[] };

type PacketListItem = {
  id: number;
  packet_name: string;
  documents_count: number;
};

function toNumId(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : -1;
}

function uniqById(list: Doc[]): Doc[] {
  const seen = new Set<number>();
  const out: Doc[] = [];
  for (const d of list) {
    if (!d || d.id <= 0) continue;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d);
  }
  return out;
}

function SortableRow({
  doc,
  onRemove,
}: {
  doc: Doc;
  onRemove: (id: number) => void;
}) {
  const sortableId = `doc-${doc.id}`;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center bg-white border border-gray-300 h-10 px-2 rounded-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-500 hover:text-gray-800 px-1"
        title="Drag"
      >
        <TbGripVertical size={18} />
      </button>

      <div className="flex-1 text-xs text-gray-800 truncate">
        {doc.document_name}
      </div>

      <button
        type="button"
        onClick={() => onRemove(doc.id)}
        className="w-6 h-6 grid place-items-center rounded-full bg-gray-300 hover:bg-gray-400 text-gray-800"
        title="Remove"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

export default function PacketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const packetIdNum = useMemo(() => toNumId(params?.id), [params]);

  const [loading, setLoading] = useState(false);

  // LEFT: packets list
  const [packetSearch, setPacketSearch] = useState("");
  const [packets, setPackets] = useState<PacketListItem[]>([]);

  // RIGHT: packet editor
  const [packetName, setPacketName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  // docs
  const [docsChanged, setDocsChanged] = useState(false);
  const [allDocs, setAllDocs] = useState<Doc[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Doc[]>([]);

  // “Add new document” search (dropdown only)
  const [docSearch, setDocSearch] = useState("");
  const [showDocDropdown, setShowDocDropdown] = useState(false);

 const normalizePacketDocs = useCallback((docs: any[]): Doc[] => {
   const normalized = [...(docs || [])]
     .map((d: any) => {
       // supports both formats:
       // A) { document_id, sort_order, document_name, category }
       // B) { id, document_name, category }
       const id = toNumId(d?.document_id ?? d?.id);

       return {
         id,
         document_name: String(d?.document_name || `Document #${id}`),
         category: String(d?.category || ""),
         // keep order if exists, otherwise 0
         _order: Number(d?.sort_order ?? d?.sortOrder ?? 0),
       };
     })
     .filter((d: any) => d.id > 0)
     .sort((a: any, b: any) => a._order - b._order)
     .map(({ _order, ...rest }: any) => rest);

   return uniqById(normalized);
 }, []);


  const fetchPackets = useCallback(async () => {
    try {
      const qs = packetSearch.trim()
        ? `?search=${encodeURIComponent(packetSearch.trim())}`
        : "";
      const res = await fetch(`/api/packets${qs}`, { cache: "no-store" });
      const data = await res.json();

      const list: PacketListItem[] =
        data?.packets || data?.data || (Array.isArray(data) ? data : []) || [];

      const safe = (list || [])
        .map((p: any) => ({
          id: toNumId(p?.id),
          packet_name: String(p?.packet_name || ""),
          documents_count: Number(p?.documents_count ?? 0),
        }))
        .filter((p) => p.id > 0 && p.packet_name);

      setPackets(safe);
    } catch {
      setPackets([]);
    }
  }, [packetSearch]);

  const fetchPacket = useCallback(async () => {
    if (packetIdNum <= 0) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/packets/${packetIdNum}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to load packet");
      }

      const pkt: Packet = data?.packet || data?.data || data;

      setPacketName(pkt?.packet_name || "");
const docsFromApi =
  (pkt as any)?.documents ||
  (pkt as any)?.packet_documents ||
  (pkt as any)?.packetDocs ||
  [];

setSelectedDocs(normalizePacketDocs(docsFromApi));
      setDocsChanged(false);
      setDocSearch("");
      setShowDocDropdown(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load packet");
      router.push("/dashboard/admin/document-management/packets");
    } finally {
      setLoading(false);
    }
  }, [packetIdNum, normalizePacketDocs, router]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/template-documents", { cache: "no-store" });
      const data = await res.json();

      const raw =
        data?.documents ||
        data?.data ||
        (Array.isArray(data) ? data : []) ||
        [];

      const list: Doc[] = (raw || [])
        .map(
          (d: any): Doc => ({
            id: toNumId(d?.id),
            document_name: String(d?.document_name || ""),
            category: String(d?.category || ""),
          })
        )
        .filter((d: Doc) => d.id > 0 && d.document_name.trim().length > 0);


      setAllDocs(uniqById(list));
    } catch {
      setAllDocs([]);
    }
  }, []);

  useEffect(() => {
    fetchPackets();
  }, [fetchPackets]);

  useEffect(() => {
    fetchPacket();
    fetchDocuments();
  }, [fetchPacket, fetchDocuments]);

  // Left packets filter
  const filteredPackets = useMemo(() => {
    const q = packetSearch.trim().toLowerCase();
    if (!q) return packets;
    return packets.filter((p) => p.packet_name.toLowerCase().includes(q));
  }, [packets, packetSearch]);

  // Dropdown results: filter from ALL docs but hide those already selected
  const docDropdownResults = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return [];

    const selectedSet = new Set(selectedDocs.map((d) => d.id));
    return allDocs
      .filter((d) => !selectedSet.has(d.id))
      .filter((d) => d.document_name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allDocs, docSearch, selectedDocs]);

  const addDoc = useCallback((doc: Doc) => {
    if (!doc?.id || doc.id <= 0) return;

    setSelectedDocs((prev) => {
      if (prev.some((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });

    setDocsChanged(true);
    setDocSearch("");
    setShowDocDropdown(false);
  }, []);

  const removeDoc = useCallback((id: number) => {
    setSelectedDocs((prev) => prev.filter((d) => d.id !== id));
    setDocsChanged(true);
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    setSelectedDocs((items) => {
      const ids = items.map((x) => `doc-${x.id}`);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });

    setDocsChanged(true);
  }, []);

  const savePacket = useCallback(async () => {
    if (packetIdNum <= 0) return;

    if (!packetName.trim()) {
      toast.error("Packet name is required");
      return;
    }

    try {
      setLoading(true);

      const payload: any = { packet_name: packetName.trim() };

      // only send docs if changed
      if (docsChanged) {
        payload.documents = selectedDocs.map((d, i) => ({
          document_id: d.id,
          sort_order: i + 1,
        }));
      }

      const res = await fetch(`/api/packets/${packetIdNum}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to save packet");
      }

      // ✅ no alert popup, redirect to list
      router.push("/dashboard/admin/document-management/packets");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }, [packetIdNum, packetName, docsChanged, selectedDocs, router]);

  const sortableItems = useMemo(
    () => selectedDocs.map((d) => `doc-${d.id}`),
    [selectedDocs]
  );

  const activeId = packetIdNum;

  return (
    <div className="bg-[#e5e7eb] min-h-screen">
      {/* ✅ TWO COLUMNS ONLY */}
      <div className="grid grid-cols-12 h-[calc(100vh-0px)]">
        {/* LEFT: Packets list */}
        <div className="col-span-5 border-r border-gray-300 bg-[#efefef]">
          <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-300 bg-white">
            <div className="relative flex-1">
              <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={packetSearch}
                onChange={(e) => setPacketSearch(e.target.value)}
                placeholder="Filter Packets..."
                className="w-full h-8 pl-7 pr-2 border border-gray-300 text-xs outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/admin/document-management/packets/create"
                )
              }
              className="h-8 px-2 text-[10px] border border-blue-400 text-blue-600 bg-white rounded hover:bg-blue-50"
            >
              CREATE NEW PACKET
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-48px)]">
            {filteredPackets.map((p) => (
              <button
                key={`pkt-${p.id}`}
                type="button"
                onClick={() =>
                  router.push(
                    `/dashboard/admin/document-management/packets/${p.id}`
                  )
                }
                className={`w-full flex items-center justify-between px-3 py-2 border-b border-gray-300 text-left ${
                  activeId === p.id
                    ? "bg-[#cfe8ff]"
                    : "bg-[#efefef] hover:bg-gray-200"
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-gray-800">
                    {p.packet_name}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    ( {p.documents_count} Documents )
                  </div>
                </div>
                <FiChevronRight className="text-gray-500" />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Packet editor (single panel) */}
        <div className="col-span-7 bg-[#e5e7eb] flex flex-col">
          {/* header */}
          <div className="bg-[#6b7280] text-white px-3 py-2 flex items-center justify-between">
            <div className="text-sm font-semibold">
              {packetName || "Packet"}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="text-[10px] border border-white/60 px-2 py-1 rounded bg-black/30 hover:bg-black/40"
              >
                Edit Name
              </button>
              <button
                type="button"
                onClick={fetchPacket}
                className="p-1 rounded hover:bg-white/15"
                title="Refresh"
              >
                <FiRefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* name edit row */}
          {isEditingName && (
            <div className="bg-white border-b border-gray-300 px-3 py-2">
              <div className="text-[11px] font-semibold text-gray-700 mb-1">
                Packet Name <span className="text-red-500">*</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={packetName}
                  onChange={(e) => setPacketName(e.target.value)}
                  className="flex-1 h-8 px-2 border border-gray-300 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="h-8 px-3 text-[11px] border border-gray-300 bg-gray-100 hover:bg-gray-200"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Add a Document title row */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300 bg-[#d1d5db]">
            <span className="text-xs font-semibold text-gray-800">
              Add a Document to Packet
            </span>
            <FiSearch className="text-gray-700" size={14} />
          </div>

          {/* Search to add (NO COLUMN) */}
          <div className="px-3 pt-3">
            <div className="relative">
              <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={docSearch}
                onChange={(e) => {
                  setDocSearch(e.target.value);
                  setShowDocDropdown(true);
                }}
                onFocus={() => setShowDocDropdown(true)}
                onBlur={() => {
                  // allow click selection
                  setTimeout(() => setShowDocDropdown(false), 120);
                }}
                placeholder="Filter Documents..."
                className="w-full h-8 pl-7 pr-2 border border-gray-300 text-xs outline-none bg-white"
              />

              {/* dropdown results */}
              {showDocDropdown && docDropdownResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 shadow-sm max-h-64 overflow-y-auto">
                  {docDropdownResults.map((d) => (
                    <button
                      key={`dd-${d.id}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addDoc(d)}
                      className="w-full text-left px-3 py-2 border-b border-gray-200 hover:bg-gray-100"
                    >
                      <div className="text-xs text-gray-800">
                        {d.document_name}
                      </div>
                      <div className="text-[11px] text-gray-600">
                        {d.category}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected docs title */}
          <div className="px-3 py-3">
            <div className="text-xs font-semibold text-gray-800 mb-2">
              {packetName || "Packet"} ({selectedDocs.length} Documents)
            </div>

            {loading ? (
              <div className="text-xs text-gray-600">Loading...</div>
            ) : selectedDocs.length === 0 ? (
              <div className="text-xs text-gray-600">
                No documents in this packet yet.
              </div>
            ) : (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortableItems}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {selectedDocs.map((doc) => (
                      <SortableRow
                        key={`sel-${doc.id}`}
                        doc={doc}
                        onRemove={removeDoc}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="mt-3 text-[11px] text-gray-600">
              Tip: Drag documents using the dotted handle.
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={savePacket}
                disabled={loading}
                className="h-8 px-6 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push("/dashboard/admin/document-management/packets")
                }
                className="h-8 px-6 text-xs bg-gray-200 border border-gray-300 rounded hover:bg-gray-300"
              >
                Back
              </button>
            </div>
          </div>

          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
