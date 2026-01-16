"use client";

import { useEffect, useMemo, useState } from "react";
import PanelWithHeader from "@/components/PanelWithHeader";

type TearsheetRow = {
  id: number;
  name: string;
  job_seeker_count: number;
  hiring_manager_count: number;
  job_order_count: number;
  lead_count: number;
  owner_name?: string | null;
  created_at?: string | null;
};

type RecordItem = {
  id: number;
  name: string;
  email?: string;
  company?: string;
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

  // Modal state
  const [selectedTearsheet, setSelectedTearsheet] = useState<{
    id: number;
    name: string;
    type: string;
    records: RecordItem[];
  } | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

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

  const handleCountClick = async (tearsheetId: number, tearsheetName: string, type: string, count: number) => {
    if (count === 0) return; // Don't open modal if count is 0

    setIsLoadingRecords(true);
    try {
      const res = await fetch(`/api/tearsheets/${tearsheetId}/records?type=${type}`);
      const data = await res.json();

      if (res.ok) {
        setSelectedTearsheet({
          id: tearsheetId,
          name: tearsheetName,
          type,
          records: data.records || []
        });
      } else {
        console.error('Failed to fetch records:', data.message);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'job_seekers': 'Job Seekers',
      'hiring_managers': 'Hiring Managers',
      'jobs': 'Job Orders',
      'leads': 'Leads'
    };
    return labels[type] || type;
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
                      <button
                        onClick={() => handleCountClick(r.id, r.name, 'job_seekers', r.job_seeker_count)}
                        className={`${r.job_seeker_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
                        disabled={r.job_seeker_count === 0}
                      >
                        {r.job_seeker_count || 0}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      <button
                        onClick={() => handleCountClick(r.id, r.name, 'hiring_managers', r.hiring_manager_count)}
                        className={`${r.hiring_manager_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
                        disabled={r.hiring_manager_count === 0}
                      >
                        {r.hiring_manager_count || 0}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      <button
                        onClick={() => handleCountClick(r.id, r.name, 'jobs', r.job_order_count)}
                        className={`${r.job_order_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
                        disabled={r.job_order_count === 0}
                      >
                        {r.job_order_count || 0}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      <button
                        onClick={() => handleCountClick(r.id, r.name, 'leads', r.lead_count)}
                        className={`${r.lead_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
                        disabled={r.lead_count === 0}
                      >
                        {r.lead_count || 0}
                      </button>
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

      {/* Records Modal */}
      {selectedTearsheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {getTypeLabel(selectedTearsheet.type)} in "{selectedTearsheet.name}"
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {selectedTearsheet.records.length} record(s)
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingRecords ? (
                <div className="text-center py-8 text-gray-500">
                  Loading records...
                </div>
              ) : selectedTearsheet.records.length > 0 ? (
                <div className="space-y-3">
                  {selectedTearsheet.records.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{record.name}</div>
                      {record.email && (
                        <div className="text-sm text-gray-600 mt-1">{record.email}</div>
                      )}
                      {record.company && (
                        <div className="text-sm text-gray-600 mt-1">Company: {record.company}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No records found
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setSelectedTearsheet(null)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelWithHeader>
  );
};

export default TearsheetsPage;
