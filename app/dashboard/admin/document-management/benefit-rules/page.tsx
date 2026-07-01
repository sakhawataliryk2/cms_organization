"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Rule = {
  id: number;
  employment_type: string;
  packet_id: number;
  min_days_employed: number;
  min_avg_weekly_hours: number;
  weeks_required: number;
  enabled: boolean;
};

type Packet = { id: number; packet_name: string };

export default function BenefitPackageRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    employment_type: "Temp to Hire",
    packet_id: "",
    min_days_employed: "60",
    min_avg_weekly_hours: "30",
    weeks_required: "4",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [rulesRes, packetsRes] = await Promise.all([
        fetch("/api/admin/benefit-package-rules", { cache: "no-store" }),
        fetch("/api/packets", { cache: "no-store" }),
      ]);
      const rulesJson = await rulesRes.json().catch(() => ({}));
      const packetsJson = await packetsRes.json().catch(() => ({}));
      setRules(Array.isArray(rulesJson?.rules) ? rulesJson.rules : []);
      setPackets(Array.isArray(packetsJson?.packets) ? packetsJson.packets : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.packet_id) {
      toast.error("Select a packet");
      return;
    }
    const res = await fetch("/api/admin/benefit-package-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employment_type: form.employment_type,
        packet_id: Number(form.packet_id),
        min_days_employed: Number(form.min_days_employed),
        min_avg_weekly_hours: Number(form.min_avg_weekly_hours),
        weeks_required: Number(form.weeks_required),
        enabled: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.message || "Failed to save rule");
      return;
    }
    toast.success("Rule saved");
    await load();
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Benefit Package Rules</h1>
        <p className="text-sm text-slate-600 mt-1">
          Map employment types to onboarding packets for automated benefit package sends.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add / update rule</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Employment type
            <select
              className="mt-1 w-full border rounded px-2 py-1"
              value={form.employment_type}
              onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
            >
              {["Temp to Hire", "Contract", "Direct Hire", "Executive Search"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Packet
            <select
              className="mt-1 w-full border rounded px-2 py-1"
              value={form.packet_id}
              onChange={(e) => setForm((f) => ({ ...f, packet_id: e.target.value }))}
            >
              <option value="">Select packet...</option>
              {packets.map((p) => (
                <option key={p.id} value={p.id}>{p.packet_name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Min days employed
            <input className="mt-1 w-full border rounded px-2 py-1" value={form.min_days_employed}
              onChange={(e) => setForm((f) => ({ ...f, min_days_employed: e.target.value }))} />
          </label>
          <label className="text-sm">
            Min avg weekly hours
            <input className="mt-1 w-full border rounded px-2 py-1" value={form.min_avg_weekly_hours}
              onChange={(e) => setForm((f) => ({ ...f, min_avg_weekly_hours: e.target.value }))} />
          </label>
        </div>
        <button type="button" onClick={save} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded">
          Save rule
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-2">Employment type</th>
              <th className="p-2">Packet ID</th>
              <th className="p-2">Min days</th>
              <th className="p-2">Min avg hrs</th>
              <th className="p-2">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-slate-500">Loading...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-slate-500">No rules configured.</td></tr>
            ) : rules.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.employment_type}</td>
                <td className="p-2">{r.packet_id}</td>
                <td className="p-2">{r.min_days_employed}</td>
                <td className="p-2">{r.min_avg_weekly_hours}</td>
                <td className="p-2">{r.enabled ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
