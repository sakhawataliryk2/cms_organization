"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    FiGrid,
    FiUpload,
    FiDownload,
    FiArrowRight,
    FiCode,
    FiFileText,
    FiUsers,
    FiChevronDown,
    FiX,
    FiCheck,
    FiMail,
    FiAlertCircle,
    FiActivity
} from 'react-icons/fi';
type JobSeeker = {
  id: number;
  name?: string;
  email?: string;
};

type Packet = {
  id: number;
  packet_name: string;
};

type Doc = {
  id: number;
  document_name: string;
  category: string;
};
type Job = {
  id: number;
  job_title?: string;
  title?: string;
};

type JobsResponse =
  | { success: boolean; jobs: Job[] }
  | { success: boolean; data: Job[] }
  | Job[];
type PacketsResponse = {
  success: boolean;
  packets: Packet[];
};

type DocsResponse =
  | { success: boolean; documents: Doc[] }
  | { success: boolean; template_documents: Doc[] }
  | { success: boolean; data: Doc[] }
  | Doc[];
  

export default function SendOnboardingModal({
  jobSeeker,
  onClose,
  onSent,
}: {
  jobSeeker: JobSeeker;
  onClose: () => void;
  onSent?: () => void; 
}) {
  const [q, setQ] = useState("");

  const [packets, setPackets] = useState<Packet[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPackets, setSelectedPackets] = useState<Record<number, boolean>>({});
  const [selectedDocs, setSelectedDocs] = useState<Record<number, boolean>>({});

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState<number | "">("");
const [isOpen, setIsOpen] = useState(false); 
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

       
        const [pRes, dRes, jRes] = await Promise.all([
          fetch(`/api/packets`, { method: "GET", headers, cache: "no-store" }),
          fetch(`/api/template-documents`, { method: "GET", headers, cache: "no-store" }),
          fetch(`/api/jobs`, { method: "GET", headers, cache: "no-store" }),
        ]);

        if (!pRes.ok) throw new Error(`Packets fetch failed (${pRes.status})`);
        if (!dRes.ok) throw new Error(`Documents fetch failed (${dRes.status})`);
        if (!jRes.ok) throw new Error(`Jobs fetch failed (${jRes.status})`);
        const pJson: PacketsResponse = await pRes.json();
        const dJson: DocsResponse = await dRes.json();
        if (!alive) return;

        setPackets(Array.isArray((pJson as any)?.packets) ? (pJson as any).packets : []);

        const docsArr = Array.isArray(dJson)
          ? dJson
          : (dJson as any).documents ??
            (dJson as any).template_documents ??
            (dJson as any).data ??
            [];
            const jJson: JobsResponse = await jRes.json();

            const jobsArr = Array.isArray(jJson)
              ? jJson
              : (jJson as any).jobs ?? (jJson as any).data ?? [];

            setJobs(Array.isArray(jobsArr) ? jobsArr : []);

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
  }, []);

  const filteredPackets = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return packets;
    return packets.filter((p) => (p.packet_name || "").toLowerCase().includes(s));
  }, [q, packets]);

  const filteredDocs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter((d) => (d.document_name || "").toLowerCase().includes(s));
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
      toast.error("Select at least 1 packet or document.");
      return;
    }
    if (!jobId) {
        toast.error("Select a job.");
        return;
      }
    try {
      setLoading(true);
      setError(null);

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...authHeaders(),
      };

      const res = await fetch(`/api/onboarding/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          job_seeker_id: jobSeeker.id,
          job_id: jobId,
          packet_ids: chosenPacketIds,
          document_ids: chosenDocIds,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to send onboarding");

      onSent?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to send onboarding");
    } finally {
      setLoading(false);
    }
  }

return (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    {/* 1. Yahan se 'overflow-hidden' hata diya taaki dropdown menu nazar aaye */}
    <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
        <h3 className="text-lg font-semibold text-gray-800">Send Onboarding Documents</h3>
        <button className="text-gray-500 hover:text-gray-800 transition" onClick={onClose}>✕</button>
      </div>

      {/* Body: Isko 'overflow-visible' rakha hai dropdown ke liye */}
      <div className="px-6 py-5 space-y-4">
        
        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Available Packets & Documents"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
       <div className="relative">
        {/* Trigger Button */}
            <button 
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              onBlur={() => setTimeout(() => setIsOpen(false), 200)} 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 flex justify-between items-center bg-white text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <span className="truncate">
                {jobs.find(j => j.id === jobId)?.job_title || (jobs.find(j => j.id === jobId) as any)?.title || "Select Job"}
              </span>
         
              <FiChevronDown className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[60] max-h-80 overflow-y-auto">
                <div 
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-500 border-b"
                  onClick={() => { setJobId(""); setIsOpen(false); }}
                >
                  Select Job
                </div>
                
                {jobs.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-400 italic">No jobs available</div>
                ) : (
                  jobs.map((j) => (
                    <div
                      key={j.id}
                      className={`px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 transition-colors ${jobId === j.id ? 'bg-blue-50 font-medium text-blue-600' : 'text-gray-700'}`}
                      onClick={() => {
                        setJobId(j.id);
                        setIsOpen(false);
                      }}
                    >
                      {j.job_title || (j as any).title || `Job #${j.id}`}
                    </div>
                  ))
                )}
              </div>
            )}
    </div>




        {loading && <div className="text-sm text-gray-500">Loading...</div>}

        {/* Scrollable Content: Sirf is area ko scrollable banaya hai */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="max-h-[35vh] overflow-y-auto custom-scrollbar">
            {/* PACKETS SECTION */}
            <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 sticky top-0">PACKETS</div>
            {filteredPackets.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No packets found.</div>
            ) : (
              filteredPackets.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer border-b last:border-0">
                  <input type="checkbox" checked={!!selectedPackets[p.id]} onChange={() => togglePacket(p.id)} />
                  {p.packet_name}
                </label>
              ))
            )}

            {/* DOCUMENTS SECTION */}
            <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 sticky top-0">DOCUMENTS</div>
            {filteredDocs.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No documents found.</div>
            ) : (
              filteredDocs.map((d) => (
                <label key={d.id} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer border-b last:border-0">
                  <input type="checkbox" checked={!!selectedDocs[d.id]} onChange={() => toggleDoc(d.id)} />
                  <span>{d.document_name} {d.category && <span className="text-xs text-gray-500 ml-1">• {d.category}</span>}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="text-sm text-gray-700 pt-2">
          Recipient: <span className="font-medium ml-1">{jobSeeker?.email || "-"}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
        <button className="px-4 py-2 border rounded-lg hover:bg-gray-100" onClick={onClose}>Cancel</button>
        <button disabled={loading} className={`px-4 py-2 rounded-lg text-white ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`} onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  </div>
);
}