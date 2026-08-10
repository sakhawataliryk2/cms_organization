"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { ActivityReportGrid, type ActivityReportRow } from "@/components/ActivityReportGrid";
import { getNoteDateTimeValue } from "@/lib/noteUtils";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

const mockAppointments = [
  {
    id: 1,
    time: "9:00 AM",
    type: "Meeting",
    client: "Tech Corp",
    job: "Senior Developer",
    references: ["Stephanie Marcus", "Sophia Esposito"],
    owner: "Devi Arnold",
  },
  {
    id: 2,
    time: "9:30 AM",
    type: "Meeting",
    client: "Startup Inc",
    job: "Product Manager",
    references: [
      "Toni Arruda",
      "Allison Silva",
      "Devi Arnold",
      "Klaudia Gajda",
      "Jennifer Michaels",
    ],
    owner: "Briana Dozois",
  },
  {
    id: 3,
    time: "10:00 AM",
    type: "Meeting",
    client: "Consulting Firm",
    job: "Business Analyst",
    references: ["Evan Waicberg", "Rachel Howell"],
    owner: "Justin Shields",
  },
  {
    id: 4,
    time: "10:30 AM",
    type: "Meeting",
    client: "Finance Co",
    job: "Financial Advisor",
    references: ["Evan Waicberg", "Rachel Howell"],
    owner: "Devi Arnold",
  },
  {
    id: 5,
    time: "11:00 AM",
    type: "Meeting",
    client: "Marketing Agency",
    job: "Creative Director",
    references: ["Stephanie Marcus", "Sophia Esposito"],
    owner: "Briana Dozois",
  },
];

const getCalendarData = () => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarData = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const appointmentCount = Math.floor(Math.random() * 25);
    calendarData.push({
      day,
      appointmentCount,
      isCurrentMonth: true,
      isToday: day === today.getDate(),
    });
  }

  return calendarData;
};

interface GoalQuotaRow {
  userId: string;
  userName: string;
  category: string;
  notes: string;
  notesCount: number;
  addedToSystem: number;
  inboundEmails: number;
  outboundEmails: number;
  calls: number;
  texts: number;
}

const GoalsAndQuotas = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewType, setViewType] = useState("Month");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isUsersDropdownOpen, setIsUsersDropdownOpen] = useState(false);
  const usersDropdownRef = useRef<HTMLDivElement>(null);

  const [goalsQuotasData, setGoalsQuotasData] = useState<GoalQuotaRow[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Records modal
  const [selectedRecords, setSelectedRecords] = useState<{
    userId: string;
    category: string;
    records: any[];
  } | null>(null);
  const [showRecordsModal, setShowRecordsModal] = useState(false);

  // Notes modal
  const [selectedNotes, setSelectedNotes] = useState<{
    userId: string;
    category: string;
    notes: any[];
  } | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Date range filter
  const toISODateInput = (d: Date) => d.toISOString().slice(0, 10);
  const getMonthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(
    () => ({
      start: toISODateInput(getMonthStart(new Date())),
      end: toISODateInput(new Date()),
    })
  );

  const [isApplyingRange, setIsApplyingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const applyAbortRef = useRef<AbortController | null>(null);

  const calendarData = getCalendarData();
  const selectedDayAppointments = mockAppointments;

  const categories = [
    "Organization",
    "Jobs",
    "Job Seekers",
    "Hiring Managers",
    "Placements",
    "Leads",
  ];

  const categoryApiMap: Record<string, string> = {
    Organization: "organizations",
    Jobs: "jobs",
    "Job Seekers": "job-seekers",
    "Hiring Managers": "hiring-managers",
    Placements: "placements",
    Leads: "leads",
  };

  const categoryReportKeyMap: Record<string, string> = {
    Organization: "organizations",
    Jobs: "jobs",
    "Job Seekers": "job-seekers",
    "Hiring Managers": "hiring-managers",
    Placements: "placements",
    Leads: "leads",
  };

  const responseKeyMap: Record<string, string> = {
    Organization: "organizations",
    Jobs: "jobs",
    "Job Seekers": "jobSeekers",
    "Hiring Managers": "hiringManagers",
    Placements: "placements",
    Leads: "leads",
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      if (direction === "prev") newMonth.setMonth(prev.getMonth() - 1);
      else newMonth.setMonth(prev.getMonth() + 1);
      return newMonth;
    });
  };

  // Helper: token header
  const getAuthHeader = () => {
    const token = document.cookie.replace(
      /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    );
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const isInRange = (
    dateString: string | null | undefined,
    range: { start: string; end: string }
  ) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return false;
    const rangeStart = range.start ? new Date(`${range.start}T00:00:00`) : null;
    const rangeEnd = range.end ? new Date(`${range.end}T23:59:59.999`) : null;
    if (rangeStart && d < rangeStart) return false;
    if (rangeEnd && d > rangeEnd) return false;
    return true;
  };

  /** Efficient SQL-backed counts via /api/activity-report (avoids N+1 note fetches). */
  const fetchActivityReports = async (
    usersList: User[],
    range: { start: string; end: string },
    signal?: AbortSignal
  ) => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const concurrency = 5;
      const reportsByUser = new Map<string, Record<string, any>>();

      for (let i = 0; i < usersList.length; i += concurrency) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const batch = usersList.slice(i, i + concurrency);
        const results = await Promise.all(
          batch.map(async (user) => {
            const response = await fetch(
              `/api/activity-report?userId=${encodeURIComponent(user.id)}&start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,
              { signal, headers: getAuthHeader() }
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(data.message || `Failed to load report for ${user.name || user.email}`);
            }
            return {
              userId: String(user.id),
              categories: (data.categories || {}) as Record<string, any>,
            };
          })
        );
        for (const result of results) {
          reportsByUser.set(result.userId, result.categories);
        }
      }

      setGoalsQuotasData((prevData) =>
        prevData.map((row) => {
          const cats = reportsByUser.get(String(row.userId)) || {};
          const reportKey = categoryReportKeyMap[row.category];
          const counts = (reportKey && cats[reportKey]) || {};
          return {
            ...row,
            notesCount: Number(counts.notesCount) || 0,
            addedToSystem: Number(counts.addedToSystem) || 0,
            inboundEmails: Number(counts.inboundEmails) || 0,
            outboundEmails: Number(counts.outboundEmails) || 0,
            calls: Number(counts.calls) || 0,
            texts: Number(counts.texts) || 0,
          };
        })
      );
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      console.error("Error fetching activity reports:", error);
      setReportError(
        error instanceof Error ? error.message : "Failed to fetch activity report"
      );
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Fetch users, then load activity counts
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users/active");
        if (response.ok) {
          const data = await response.json();
          const list: User[] = data.users || [];
          setUsers(list);

          const initialData: GoalQuotaRow[] = [];
          list.forEach((user: User) => {
            categories.forEach((category) => {
              initialData.push({
                userId: user.id,
                userName: user.name || user.email,
                category,
                notes: "",
                notesCount: 0,
                addedToSystem: 0,
                inboundEmails: 0,
                outboundEmails: 0,
                calls: 0,
                texts: 0,
              });
            });
          });
          setGoalsQuotasData(initialData);

          if (list.length > 0) {
            void fetchActivityReports(list, dateRange);
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecordsClick = async (userId: string, category: string) => {
    const apiEndpoint = categoryApiMap[category];
    if (!apiEndpoint || !userId) return;

    setIsLoadingDetails(true);
    try {
      const entitiesResponse = await fetch(`/api/${apiEndpoint}`, {
        headers: getAuthHeader(),
      });
      if (!entitiesResponse.ok) {
        setSelectedRecords({ userId, category, records: [] });
        setShowRecordsModal(true);
        return;
      }

      const entitiesData = await entitiesResponse.json();
      const responseKey =
        responseKeyMap[category] || apiEndpoint.replace("-", "");
      const entities = entitiesData[responseKey] || [];
      const records = entities.filter(
        (entity: any) =>
          String(entity.created_by) === String(userId) &&
          isInRange(entity.created_at, dateRange)
      );

      setSelectedRecords({ userId, category, records });
      setShowRecordsModal(true);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleNotesClick = async (userId: string, category: string) => {
    const apiEndpoint = categoryApiMap[category];
    if (!apiEndpoint || !userId) return;

    if (category === "Placements") {
      setSelectedNotes({ userId, category, notes: [] });
      setShowNotesModal(true);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const entitiesResponse = await fetch(`/api/${apiEndpoint}`, {
        headers: getAuthHeader(),
      });
      if (!entitiesResponse.ok) {
        setSelectedNotes({ userId, category, notes: [] });
        setShowNotesModal(true);
        return;
      }

      const entitiesData = await entitiesResponse.json();
      const responseKey =
        responseKeyMap[category] || apiEndpoint.replace("-", "");
      const entities =
        entitiesData[responseKey] ||
        entitiesData[category.toLowerCase().replace(" ", "")] ||
        [];

      const notesList: any[] = [];
      const concurrency = 8;
      for (let i = 0; i < entities.length; i += concurrency) {
        const batch = entities.slice(i, i + concurrency);
        const batchNotes = await Promise.all(
          batch.map(async (entity: any) => {
            if (!entity?.id) return [] as any[];
            try {
              const notesResponse = await fetch(
                `/api/${apiEndpoint}/${entity.id}/notes`,
                { headers: getAuthHeader() }
              );
              if (!notesResponse.ok) return [] as any[];
              const notesData = await notesResponse.json();
              return (notesData.notes || [])
                .filter(
                  (note: any) =>
                    String(note.created_by) === String(userId) &&
                    isInRange(getNoteDateTimeValue(note), dateRange)
                )
                .map((note: any) => ({
                  ...note,
                  _entityId: entity.id,
                  _entityName:
                    entity.name ||
                    entity.job_title ||
                    entity.full_name ||
                    `${category} #${entity.id}`,
                  _apiEndpoint: apiEndpoint,
                }));
            } catch {
              return [] as any[];
            }
          })
        );
        for (const notes of batchNotes) notesList.push(...notes);
      }

      setSelectedNotes({ userId, category, notes: notesList });
      setShowNotesModal(true);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Filter rows
  const filteredGoalsQuotasData = goalsQuotasData.filter((row) => {
    if (selectedUsers.length === 0) return true;
    return selectedUsers.includes(row.userId);
  });

  const goalsActivityRows: ActivityReportRow[] = useMemo(
    () =>
      filteredGoalsQuotasData.map((row) => ({
        key: `${row.userId}-${row.category}`,
        categoryLabel: row.category,
        userLabel: row.userName,
        userId: row.userId,
        notesCount: row.notesCount ?? 0,
        addedToSystem: row.addedToSystem ?? 0,
        inboundEmails: row.inboundEmails ?? 0,
        outboundEmails: row.outboundEmails ?? 0,
        calls: row.calls ?? 0,
        texts: row.texts ?? 0,
      })),
    [filteredGoalsQuotasData]
  );

  // Close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        usersDropdownRef.current &&
        !usersDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUsersDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) setSelectedUsers([]);
    else setSelectedUsers(users.map((u) => u.id));
  };

  const runApply = async (range: { start: string; end: string }) => {
    if (users.length === 0) return;
    applyAbortRef.current?.abort();
    const controller = new AbortController();
    applyAbortRef.current = controller;
    setIsApplyingRange(true);
    try {
      await fetchActivityReports(users, range, controller.signal);
    } finally {
      if (applyAbortRef.current === controller) {
        setIsApplyingRange(false);
      }
    }
  };

  const applyDateRange = async () => {
    setRangeError(null);
    if (!dateRange.start || !dateRange.end) {
      setRangeError("Please select both start and end dates.");
      return;
    }
    if (dateRange.start > dateRange.end) {
      setRangeError("Start date must be before or equal to end date.");
      return;
    }
    await runApply(dateRange);
  };

  const resetToThisMonth = async () => {
    const now = new Date();
    const next = {
      start: toISODateInput(getMonthStart(now)),
      end: toISODateInput(now),
    };
    setDateRange(next);
    setRangeError(null);
    await runApply(next);
  };

  const exportToExcel = () => {
    import('xlsx').then((XLSX) => {
      const exportData = filteredGoalsQuotasData.map(row => ({
        'User': row.userName,
        'Category': row.category,
        'Notes': row.notes,
        'Notes Count': row.notesCount,
        'Added to System': row.addedToSystem,
        'Inbound Emails': row.inboundEmails,
        'Outbound Emails': row.outboundEmails,
        'Calls': row.calls,
        'Texts': row.texts
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 15 },
        { wch: 15 }, { wch: 16 }, { wch: 10 }, { wch: 10 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activity Report');
      const filename = `activity_report_${dateRange.start}_to_${dateRange.end}.xlsx`;
      XLSX.writeFile(wb, filename);
    }).catch((error) => {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export to Excel. Please try again.');
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Date range filter */}
      <div className="px-6 pt-6">
        <div className="border border-gray-300 rounded-lg bg-white p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Date range
              </div>
              <div className="text-xs text-gray-500">
                Used for Notes Count and Added to System totals.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((p) => ({ ...p, start: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((p) => ({ ...p, end: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyDateRange}
                  disabled={isApplyingRange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isApplyingRange ? "Applying..." : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={resetToThisMonth}
                  disabled={isApplyingRange}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  This Month
                </button>
              </div>
            </div>
          </div>

          {rangeError && (
            <div className="mt-2 text-sm text-red-600">{rangeError}</div>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 mt-8">
        <ActivityReportGrid
          title="ACTIVITY REPORT"
          subtitle="Counts by category for the selected users and date range."
          rows={goalsActivityRows}
          loading={isLoadingReport || isApplyingRange}
          error={reportError}
          loadingDetails={isLoadingDetails}
          onNotesClick={(row) => handleNotesClick(row.userId ?? "", row.categoryLabel)}
          onRecordsClick={(row) => handleRecordsClick(row.userId ?? "", row.categoryLabel)}
          notesModalOpen={showNotesModal}
          notesDetails={selectedNotes ? { category: selectedNotes.category, userLabel: users.find((u) => u.id === selectedNotes.userId)?.name ?? undefined, notes: selectedNotes.notes } : null}
          recordsModalOpen={showRecordsModal}
          recordsDetails={selectedRecords ? { category: selectedRecords.category, userLabel: users.find((u) => u.id === selectedRecords.userId)?.name ?? undefined, records: selectedRecords.records } : null}
          onCloseNotes={() => { setShowNotesModal(false); setSelectedNotes(null); }}
          onCloseRecords={() => { setShowRecordsModal(false); setSelectedRecords(null); }}
          headerExtra={
            <div className="flex items-center gap-3">
              <button onClick={exportToExcel} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                Export to Excel
              </button>
              <div className="relative" ref={usersDropdownRef}>
                <button onClick={() => setIsUsersDropdownOpen(!isUsersDropdownOpen)} className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <span className="text-sm font-medium text-gray-700">{selectedUsers.length === 0 ? "All Users" : selectedUsers.length === 1 ? users.find((u) => u.id === selectedUsers[0])?.name || "1 User" : `${selectedUsers.length} Users`}</span>
                  <svg className={`w-4 h-4 text-gray-500 transition-transform ${isUsersDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isUsersDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-2 border-b border-gray-200"><button onClick={selectAllUsers} className="w-full text-left px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded">{selectedUsers.length === users.length ? "Deselect All" : "Select All"}</button></div>
                    <div className="p-2">{users.length === 0 ? <div className="px-3 py-2 text-sm text-gray-500">No users available</div> : users.map((user) => (<label key={user.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"><input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => toggleUserSelection(user.id)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2" /><span className="text-sm text-gray-700">{user.name || user.email}</span></label>))}</div>
                    {selectedUsers.length > 0 && <div className="p-2 border-t border-gray-200"><div className="px-3 py-2 text-xs text-gray-500">{selectedUsers.length} user(s) selected</div></div>}
                  </div>
                )}
              </div>
            </div>
          }
        />
      </div>

      {/* Notes and Records modals are rendered inside ActivityReportGrid */}
    </div>
  );
};

export default GoalsAndQuotas;
