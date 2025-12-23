"use client";

import { useEffect, useMemo, useState } from "react";
import PanelWithHeader from "@/components/PanelWithHeader";

type TearsheetRow = {
  id: number;
  name: string;
  job_seeker_name?: string | null;
  hiring_manager_name?: string | null;
  job_order?: string | null;
  lead_name?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const TearsheetsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TearsheetRow[]>([]);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  const fetchTearsheets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tearsheets", { cache: "no-store" });
      const data = await res.json();
      console.log('Tearsheets data:', data);

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch tearsheets");
      }
      setRows(data.tearsheets || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch tearsheets");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTearsheets();
  }, []);

  return (
    <PanelWithHeader title="Tearsheets">
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="text-sm text-gray-600">
            {isLoading ? "Loading..." : `${rows.length} tearsheet(s)`}
          </div>
          <button
            type="button"
            onClick={fetchTearsheets}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-200"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-600 border-b border-gray-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Job Seeker
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Hiring Manager
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Job Order
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Lead
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Owner
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date Added
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-sm text-gray-500">
                    Loading tearsheets...
                  </td>
                </tr>
              ) : hasRows ? (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {r.name || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {r.job_seeker_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {r.hiring_manager_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {r.job_order || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {r.lead_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {r.owner_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {formatDateTime(r.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-sm text-gray-500">
                    No tearsheets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PanelWithHeader>
  );
};

export default TearsheetsPage;