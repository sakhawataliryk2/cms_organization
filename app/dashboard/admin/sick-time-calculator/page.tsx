"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { FiArrowLeft, FiCalendar, FiSave, FiSearch } from "react-icons/fi";
import { toast } from "sonner";
import ModuleListGuard from "@/components/ModuleListGuard";
import { US_STATES } from "@/lib/usStates";

type RateRow = {
  state_code: string;
  state_name: string;
  hours_worked: string;
};

function toInputValue(value: unknown): string {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return String(num);
}

export default function SickTimeCalculatorPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RateRow[]>(() =>
    US_STATES.map((s) => ({
      state_code: s.code,
      state_name: s.name,
      hours_worked: "",
    })),
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyRates = useCallback((rates: Array<{
    state_code?: string;
    state_name?: string;
    hours_worked?: number | null;
  }>) => {
    const byCode = new Map(
      rates.map((r) => [String(r.state_code || "").toUpperCase(), r]),
    );
    const next = US_STATES.map((s) => {
      const match = byCode.get(s.code);
      return {
        state_code: s.code,
        state_name: match?.state_name || s.name,
        hours_worked: toInputValue(match?.hours_worked),
      };
    });
    setRows(next);
    setSavedSnapshot(JSON.stringify(next.map((r) => [r.state_code, r.hours_worked])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sick-time-calculator", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.message || "Failed to load sick time rates");
        return;
      }
      applyRates(Array.isArray(json?.rates) ? json.rates : []);
    } catch {
      toast.error("Failed to load sick time rates");
    } finally {
      setLoading(false);
    }
  }, [applyRates]);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = useMemo(() => {
    const current = JSON.stringify(rows.map((r) => [r.state_code, r.hours_worked]));
    return current !== savedSnapshot;
  }, [rows, savedSnapshot]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.state_name.toLowerCase().includes(term) ||
        r.state_code.toLowerCase().includes(term),
    );
  }, [rows, search]);

  const filledCount = useMemo(
    () => rows.filter((r) => r.hours_worked.trim() !== "").length,
    [rows],
  );

  const updateHours = (stateCode: string, value: string) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setRows((prev) =>
      prev.map((r) =>
        r.state_code === stateCode ? { ...r, hours_worked: value } : r,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sick-time-calculator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rates: rows.map((r) => ({
            state_code: r.state_code,
            hours_worked: r.hours_worked.trim() === "" ? null : Number(r.hours_worked),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.message || "Failed to save sick time rates");
        return;
      }
      applyRates(Array.isArray(json?.rates) ? json.rates : rows);
      toast.success("Sick time rates saved");
    } catch {
      toast.error("Failed to save sick time rates");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleListGuard module="admin">
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.push("/dashboard/admin")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <FiArrowLeft size={20} />
            Back to Admin Center
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50/80 px-4 sm:px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-900 flex items-center justify-center rounded-xl shadow">
                    <FiCalendar size={28} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Sick Time Calculator
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Each state requires a different number of hours worked
                      before sick time is earned. TBI Timesheets uses these
                      values to calculate accrued sick time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || loading || !isDirty}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiSave size={16} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search states..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-sm text-gray-500">
                {filledCount} of {rows.length} states configured
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left sticky top-0">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 font-semibold text-gray-700 w-1/2">
                      State
                    </th>
                    <th className="px-4 sm:px-6 py-3 font-semibold text-gray-700">
                      Hours to earn sick time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                        No states match that search.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.state_code} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-2.5 text-gray-900">
                          {row.state_name}
                          <span className="ml-2 text-xs text-gray-400">{row.state_code}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-2.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.hours_worked}
                            onChange={(e) => updateHours(row.state_code, e.target.value)}
                            placeholder="e.g. 30"
                            className="w-full max-w-48 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`Hours to earn sick time in ${row.state_name}`}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              Enter the number of hours a person must work to earn 1 hour of
              sick time. Leave blank if that state has no sick-time accrual.
            </div>
          </div>
        </div>
      </div>
    </ModuleListGuard>
  );
}
