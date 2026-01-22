"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import PanelWithHeader from "@/components/PanelWithHeader";
import ActionDropdown from "@/components/ActionDropdown";
import { FiX, FiPrinter, FiLock, FiUnlock } from "react-icons/fi";

type TearsheetRow = {
  id: number;
  name: string;
  job_seeker_count: number;
  hiring_manager_count: number;
  job_order_count: number;
  lead_count: number;
  owner_name?: string | null;
  created_at?: string | null;
  last_opened_at?: string | null;
};

type RecordItem = {
  id: number;
  name: string;
  email?: string;
  company?: string;
  type: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

const TearsheetsPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TearsheetRow[]>([]);
  const [isPinned, setIsPinned] = useState(false);

  // Modal state for tearsheet details
  const [selectedTearsheet, setSelectedTearsheet] = useState<{
    id: number;
    name: string;
    records: RecordItem[];
  } | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Actions modal state
  const [selectedTearsheetForAction, setSelectedTearsheetForAction] = useState<TearsheetRow | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [internalUsers, setInternalUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  // Load pinned state from localStorage
  useEffect(() => {
    const pinned = localStorage.getItem('tearsheetsPinned');
    if (pinned === 'true') {
      setIsPinned(true);
    }
  }, []);

  const fetchTearsheets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tearsheets", { cache: "no-store" });
      const data = await res.json();

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

  // Track last opened date when viewing tearsheet
  const trackTearsheetView = async (tearsheetId: number) => {
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch(`/api/tearsheets/${tearsheetId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Refresh tearsheets to update last_opened_at in the UI
        fetchTearsheets();
      }
    } catch (err) {
      console.error('Error tracking tearsheet view:', err);
      // Don't throw - tracking failure shouldn't block user action
    }
  };

  // Handle tearsheet name click - show all affiliated records
  const handleTearsheetNameClick = async (tearsheet: TearsheetRow) => {
    setIsLoadingRecords(true);
    setSelectedTearsheet({ id: tearsheet.id, name: tearsheet.name, records: [] });
    
    // Track view
    await trackTearsheetView(tearsheet.id);

    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const allRecords: RecordItem[] = [];

      // Fetch all record types in parallel
      const types = ['job_seekers', 'hiring_managers', 'jobs', 'leads'];
      const promises = types.map(async (type) => {
        try {
          const res = await fetch(`/api/tearsheets/${tearsheet.id}/records?type=${type}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (res.ok && data.records) {
            return data.records.map((record: any) => ({
              ...record,
              type,
            }));
          }
          return [];
        } catch (err) {
          console.error(`Error fetching ${type}:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach((records) => {
        allRecords.push(...records);
      });

      setSelectedTearsheet({
        id: tearsheet.id,
        name: tearsheet.name,
        records: allRecords,
      });
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleCountClick = async (tearsheetId: number, tearsheetName: string, type: string, count: number) => {
    if (count === 0) return;

    setIsLoadingRecords(true);
    // Track view when clicking count buttons
    await trackTearsheetView(tearsheetId);
    
    try {
      const res = await fetch(`/api/tearsheets/${tearsheetId}/records?type=${type}`);
      const data = await res.json();

      if (res.ok) {
        setSelectedTearsheet({
          id: tearsheetId,
          name: tearsheetName,
          records: (data.records || []).map((r: any) => ({ ...r, type })),
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

  const handleSendInternally = () => {
    setShowSendModal(true);
    fetchInternalUsers();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  // Fetch internal users for Send Internally
  const fetchInternalUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch("/api/users/active", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter to only internal system users
        const internal = (data.users || []).filter((user: any) => {
          return (
            user.user_type === "internal" ||
            user.role === "admin" ||
            user.role === "user" ||
            (!user.user_type && user.email)
          );
        });
        setInternalUsers(internal);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Send email to selected users
  const handleSendEmail = async () => {
    if (!selectedTearsheetForAction || selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }

    setIsSending(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const baseUrl = window.location.origin;
      const tearsheetUrl = `${baseUrl}/dashboard/tearsheets?id=${selectedTearsheetForAction.id}`;

      const response = await fetch(`/api/tearsheets/${selectedTearsheetForAction.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          tearsheetUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email');
      }

      alert('Email sent successfully');
      setShowSendModal(false);
      setSelectedUsers([]);
      setSelectedTearsheetForAction(null);
    } catch (err) {
      console.error('Error sending email:', err);
      alert(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Delete tearsheet
  const handleDeleteTearsheet = async () => {
    if (!selectedTearsheetForAction) return;

    setIsDeleting(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch(`/api/tearsheets/${selectedTearsheetForAction.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete tearsheet');
      }

      alert('Tearsheet deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedTearsheetForAction(null);
      fetchTearsheets();
    } catch (err) {
      console.error('Error deleting tearsheet:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete tearsheet');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle close
  const handleClose = () => {
    router.push('/dashboard');
  };

  // Handle pin toggle
  const handlePinToggle = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);
    localStorage.setItem('tearsheetsPinned', newPinnedState ? 'true' : 'false');
  };

  // Navigate to record
  const navigateToRecord = (record: RecordItem) => {
    if (record.type === 'job_seekers') {
      router.push(`/dashboard/job-seekers/view?id=${record.id}`);
    } else if (record.type === 'hiring_managers') {
      router.push(`/dashboard/hiring-managers/view?id=${record.id}`);
    } else if (record.type === 'jobs') {
      router.push(`/dashboard/jobs/view?id=${record.id}`);
    } else if (record.type === 'leads') {
      router.push(`/dashboard/leads/view?id=${record.id}`);
    }
  };

  useEffect(() => {
    fetchTearsheets();
  }, []);

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <PanelWithHeader title="Tearsheets">
        <div className="bg-white rounded-lg shadow">
          {/* Header with action icons */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 no-print">
            <div className="text-sm text-gray-600">
              {isLoading ? "Loading..." : `${rows.length} tearsheet(s)`}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={fetchTearsheets}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-200"
              >
                Refresh
              </button>
              <button
                onClick={handlePinToggle}
                className="p-2 text-gray-600 hover:text-gray-800"
                title={isPinned ? 'Unpin' : 'Pin'}
              >
                {isPinned ? <FiLock size={20} /> : <FiUnlock size={20} />}
              </button>
              <button
                onClick={handlePrint}
                className="p-2 text-gray-600 hover:text-gray-800"
                title="Print"
              >
                <FiPrinter size={20} />
              </button>
              <button
                onClick={handleClose}
                className="p-2 text-gray-600 hover:text-gray-800"
                title="Close"
              >
                <FiX size={20} />
              </button>
            </div>
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
                    Actions
                  </th>
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
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Last Date Opened
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-6 text-sm text-gray-500">
                      Loading tearsheets...
                    </td>
                  </tr>
                ) : hasRows ? (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm">
                        <div className="min-w-[120px]">
                          <ActionDropdown
                            label="Actions"
                            options={[
                              {
                                label: 'Send Internally',
                                action: () => {
                                  setSelectedTearsheetForAction(r);
                                  handleSendInternally();
                                },
                              },
                              {
                                label: 'Delete',
                                action: () => {
                                  setSelectedTearsheetForAction(r);
                                  handleDeleteClick();
                                },
                              },
                            ]}
                            buttonClassName="px-3 py-1 bg-gray-100 border border-gray-300 rounded flex items-center text-gray-600 hover:bg-gray-200 whitespace-nowrap"
                            menuClassName="absolute z-100 mt-1 w-56 bg-white border border-gray-300 shadow-lg text-black rounded z-10"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        <button
                          onClick={() => handleTearsheetNameClick(r)}
                          className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          {r.name || "-"}
                        </button>
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
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {formatDate(r.last_opened_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-sm text-gray-500">
                      No tearsheets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tearsheet Records Modal - Shows all affiliated records */}
        {selectedTearsheet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      All Records in "{selectedTearsheet.name}"
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedTearsheet.records.length} record(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTearsheet(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>

              {/* Modal Body - Table of Records */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingRecords ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading records...
                  </div>
                ) : selectedTearsheet.records.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedTearsheet.records.map((record, index) => (
                        <tr
                          key={`${record.type}-${record.id}-${index}`}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigateToRecord(record)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-600">{getTypeLabel(record.type)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.email || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.company || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

        {/* Send Internally Modal */}
        {showSendModal && selectedTearsheetForAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Send Tearsheet Internally
                  </h3>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSelectedUsers([]);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Internal Users
                  </label>
                  {isLoadingUsers ? (
                    <div className="text-sm text-gray-500">Loading users...</div>
                  ) : (
                    <div className="border border-gray-300 rounded max-h-64 overflow-y-auto p-2">
                      {internalUsers.length === 0 ? (
                        <div className="text-sm text-gray-500">No internal users available</div>
                      ) : (
                        internalUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">
                              {user.name || user.email}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    setSelectedUsers([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  disabled={isSending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending || selectedUsers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedTearsheetForAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Tearsheet
                </h3>
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">
                  Are you sure you want to delete the tearsheet "{selectedTearsheetForAction.name}"?
                </p>
                <p className="text-xs text-gray-500">
                  This will only delete the tearsheet record. Affiliated records (Job Seekers, Hiring Managers, Jobs, Leads) will not be affected.
                </p>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedTearsheetForAction(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTearsheet}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </PanelWithHeader>
    </>
  );
};

export default TearsheetsPage;
