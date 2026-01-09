"use client";

import { useEffect, useMemo, useState } from "react";

type JobSeeker = {
  id: number;
  name?: string;
  email?: string;
};

type Packet = {
  id: number;
  packet_name: string;
  created_at?: string;
  updated_at?: string;
  documents_count?: number;
};

type Doc = {
  id: number;
  document_name: string;
  category: string;
  created_at?: string;
  created_by_name?: string;
  file_path?: string | null;
};

type OnboardingItem = {
  id: number;
  document_name: string;
  status: "SENT" | "COMPLETED";
};

type PacketsResponse = {
  success: boolean;
  packets: Packet[];
};

type DocsResponse =
  | { success: boolean; documents: Doc[] }
  | { success: boolean; template_documents: Doc[] }
  | { success: boolean; data: Doc[] }
  | Doc[]; // fallback

export default function SendOnboardingModal({
  jobSeeker,
  onClose,
  onSent,
}: {
  jobSeeker: JobSeeker;
  onClose: () => void;
  onSent: (newItems: OnboardingItem[]) => void;
}) {
  const API_BASE = process.env.API_BASE_URL || ""; 
  const [q, setQ] = useState("");

  const [packets, setPackets] = useState<Packet[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPackets, setSelectedPackets] = useState<
    Record<number, boolean>
  >({});
  const [selectedDocs, setSelectedDocs] = useState<Record<number, boolean>>({});

  const authHeaders = (): HeadersInit => {
    const token =
      typeof document !== "undefined"
        ? document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )
        : "";

    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...authHeaders(),
        };

        const [pRes, dRes] = await Promise.all([
          fetch(`${API_BASE}/api/packets`, {
            method: "GET",
            headers,
            cache: "no-store",
          }),
          fetch(`${API_BASE}/api/template-documents`, {
            method: "GET",
            headers,
            cache: "no-store",
          }),
        ]);

        if (!pRes.ok) throw new Error(`Packets fetch failed (${pRes.status})`);
        if (!dRes.ok)
          throw new Error(`Documents fetch failed (${dRes.status})`);

        const pJson: PacketsResponse = await pRes.json();
        const dJson: DocsResponse = await dRes.json();

        if (!alive) return;

        // ✅ packets response: { success:true, packets:[...] }
        setPackets(
          Array.isArray((pJson as any)?.packets) ? (pJson as any).packets : []
        );

        // ✅ docs response could be in different keys depending on backend
        const docsArr = Array.isArray(dJson)
          ? dJson
          : (dJson as any).documents ??
            (dJson as any).template_documents ??
            (dJson as any).data ??
            [];

        setDocs(Array.isArray(docsArr) ? docsArr : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load onboarding data");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [API_BASE]);

  const filteredPackets = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return packets;
    return packets.filter((p) =>
      (p.packet_name || "").toLowerCase().includes(s)
    );
  }, [q, packets]);

  const filteredDocs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter((d) =>
      (d.document_name || "").toLowerCase().includes(s)
    );
  }, [q, docs]);

  const togglePacket = (id: number) =>
    setSelectedPackets((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleDoc = (id: number) =>
    setSelectedDocs((prev) => ({ ...prev, [id]: !prev[id] }));


 async function handleSend() {
  const chosenPacketIds = Object.keys(selectedPackets)
    .filter((k) => selectedPackets[Number(k)])
    .map(Number);

  const chosenDocIds = Object.keys(selectedDocs)
    .filter((k) => selectedDocs[Number(k)])
    .map(Number);

  if (chosenPacketIds.length === 0 && chosenDocIds.length === 0) {
    alert("Select at least 1 packet or document.");
    return;
  }

  try {
    setLoading(true);
    setError(null);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...authHeaders(),
    };

    const res = await fetch(`${API_BASE}/api/onboarding/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        job_seeker_id: jobSeeker.id,
        packet_ids: chosenPacketIds,
        document_ids: chosenDocIds,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "Failed to send onboarding");

    // backend returns items: [{id, document_name, status}]
    onSent(json?.items || []);
    onClose(); // close modal
  } catch (e: any) {
    setError(e?.message || "Failed to send onboarding");
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded shadow-lg w-full max-w-2xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Send Onboarding Documents</h3>
          <button
            className="text-gray-600 hover:text-gray-900"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Available Packets & Documents"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="text-sm text-gray-500 mb-2">
            Loading packets & documents...
          </div>
        )}
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        {/* List */}
        <div className="max-h-80 overflow-auto border rounded">
          <div className="px-3 py-2 bg-gray-50 text-xs font-semibold">
            PACKETS
          </div>

          <div className="divide-y">
            {!loading && filteredPackets.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No packets found.</div>
            ) : (
              filteredPackets.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedPackets[p.id]}
                    onChange={() => togglePacket(p.id)}
                  />
                  <span>{p.packet_name}</span>
                </label>
              ))
            )}
          </div>

          <div className="px-3 py-2 bg-gray-50 text-xs font-semibold">
            DOCUMENTS
          </div>

          <div className="divide-y">
            {!loading && filteredDocs.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">
                No documents found.
              </div>
            ) : (
              filteredDocs.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedDocs[d.id]}
                    onChange={() => toggleDoc(d.id)}
                  />
                  <span>
                    {d.document_name}
                    {d.category ? (
                      <span className="text-xs text-gray-500">
                        {" "}
                        • {d.category}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Recipient */}
        <div className="mt-3 text-sm text-gray-700">
          Recipient:{" "}
          <span className="font-medium">{jobSeeker?.email || "-"}</span>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 border rounded" onClick={onClose}>
            Close
          </button>
          <button
            disabled={loading}
            className={`px-4 py-2 rounded text-white ${
              loading
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
