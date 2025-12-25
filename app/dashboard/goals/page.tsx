"use client";

import React, { useState, useEffect, useRef } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

// Mock data for appointments
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

// Mock data for calendar days with appointment counts
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
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Records modal (already existed)
  const [recordsByUserCategory, setRecordsByUserCategory] = useState<
    Record<string, any[]>
  >({});
  const [selectedRecords, setSelectedRecords] = useState<{
    userId: string;
    category: string;
    records: any[];
  } | null>(null);
  const [showRecordsModal, setShowRecordsModal] = useState(false);

  // ✅ Notes modal (NEW)
  const [notesByUserCategory, setNotesByUserCategory] = useState<
    Record<string, any[]>
  >({});
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

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users/active");
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);

          const initialData: GoalQuotaRow[] = [];
          (data.users || []).forEach((user: User) => {
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

          // initial load
          fetchNotesCount(data.users || [], dateRange);
          fetchRecordsCount(data.users || [], dateRange);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Fetch notes count + store notes list (for modal)
  const fetchNotesCount = async (
    usersList: User[],
    range: { start: string; end: string }
  ) => {
    setIsLoadingNotes(true);
    try {
      const categoryApiMap: Record<string, string> = {
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

      const notesCountMap: Record<string, number> = {};
      const notesMap: Record<string, any[]> = {}; // ✅ store notes list too

      const rangeStart = range.start
        ? new Date(`${range.start}T00:00:00`)
        : null;
      const rangeEnd = range.end ? new Date(`${range.end}T23:59:59.999`) : null;

      const isInRange = (dateString: string | undefined) => {
        if (!dateString) return false;
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return false;
        if (rangeStart && d < rangeStart) return false;
        if (rangeEnd && d > rangeEnd) return false;
        return true;
      };

      for (const category of categories) {
        const apiEndpoint = categoryApiMap[category];
        if (!apiEndpoint) continue;

        try {
          const entitiesResponse = await fetch(`/api/${apiEndpoint}`, {
            headers: getAuthHeader(),
          });
          if (!entitiesResponse.ok) continue;

          const entitiesData = await entitiesResponse.json();
          const responseKey =
            responseKeyMap[category] || apiEndpoint.replace("-", "");
          const entities =
            entitiesData[responseKey] ||
            entitiesData[category.toLowerCase().replace(" ", "")] ||
            [];

          for (const entity of entities) {
            if (!entity?.id) continue;

            try {
              const notesResponse = await fetch(
                `/api/${apiEndpoint}/${entity.id}/notes`,
                { headers: getAuthHeader() }
              );

              if (notesResponse.ok) {
                const notesData = await notesResponse.json();
                const notes = notesData.notes || [];

                notes.forEach((note: any) => {
                  if (note.created_by && isInRange(note.created_at)) {
                    const key = `${note.created_by}-${category}`;
                    notesCountMap[key] = (notesCountMap[key] || 0) + 1;

                    if (!notesMap[key]) notesMap[key] = [];
                    notesMap[key].push({
                      ...note,
                      _entityId: entity.id,
                      _entityName:
                        entity.name ||
                        entity.job_title ||
                        entity.full_name ||
                        `${category} #${entity.id}`,
                      _apiEndpoint: apiEndpoint,
                    });
                  }
                });
              }
            } catch (err) {
              console.error(
                `Error fetching notes for ${category} entity ${entity.id}:`,
                err
              );
            }
          }
        } catch (err) {
          console.error(`Error fetching ${category} entities:`, err);
        }
      }

      // ✅ store notes list
      setNotesByUserCategory(notesMap);

      // update rows
      setGoalsQuotasData((prevData) =>
        prevData.map((row) => {
          const key = `${row.userId}-${row.category}`;
          return {
            ...row,
            notesCount: notesCountMap[key] || 0,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching notes count:", error);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // ✅ Fetch records count + store records list (already)
  const fetchRecordsCount = async (
    usersList: User[],
    range: { start: string; end: string }
  ) => {
    setIsLoadingRecords(true);
    try {
      const categoryApiMap: Record<string, string> = {
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

      const recordsMap: Record<string, any[]> = {};

      const rangeStart = range.start
        ? new Date(`${range.start}T00:00:00`)
        : null;
      const rangeEnd = range.end ? new Date(`${range.end}T23:59:59.999`) : null;

      const isEntityInRange = (entity: any) => {
        const dateString = entity?.created_at;
        if (!dateString) return false;
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return false;
        if (rangeStart && d < rangeStart) return false;
        if (rangeEnd && d > rangeEnd) return false;
        return true;
      };

      for (const category of categories) {
        const apiEndpoint = categoryApiMap[category];
        if (!apiEndpoint) continue;

        try {
          const entitiesResponse = await fetch(`/api/${apiEndpoint}`, {
            headers: getAuthHeader(),
          });
          if (!entitiesResponse.ok) continue;

          const entitiesData = await entitiesResponse.json();
          const responseKey =
            responseKeyMap[category] || apiEndpoint.replace("-", "");
          const entities = entitiesData[responseKey] || [];

          entities.forEach((entity: any) => {
            if (entity.created_by && isEntityInRange(entity)) {
              const key = `${entity.created_by}-${category}`;
              if (!recordsMap[key]) recordsMap[key] = [];
              recordsMap[key].push(entity);
            }
          });
        } catch (err) {
          console.error(`Error fetching ${category} entities:`, err);
        }
      }

      setRecordsByUserCategory(recordsMap);

      setGoalsQuotasData((prevData) =>
        prevData.map((row) => {
          const key = `${row.userId}-${row.category}`;
          return {
            ...row,
            addedToSystem: recordsMap[key]?.length || 0,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching records count:", error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // ✅ click handlers
  const handleRecordsClick = (userId: string, category: string) => {
    const key = `${userId}-${category}`;
    const records = recordsByUserCategory[key] || [];
    setSelectedRecords({ userId, category, records });
    setShowRecordsModal(true);
  };

  const handleNotesClick = (userId: string, category: string) => {
    const key = `${userId}-${category}`;
    const notes = notesByUserCategory[key] || [];
    setSelectedNotes({ userId, category, notes });
    setShowNotesModal(true);
  };

  // Filter rows
  const filteredGoalsQuotasData = goalsQuotasData.filter((row) => {
    if (selectedUsers.length === 0) return true;
    return selectedUsers.includes(row.userId);
  });

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
    if (users.length === 0) return;

    setIsApplyingRange(true);
    try {
      await Promise.all([
        fetchNotesCount(users, dateRange),
        fetchRecordsCount(users, dateRange),
      ]);
    } finally {
      setIsApplyingRange(false);
    }
  };

  const resetToThisMonth = async () => {
    const now = new Date();
    const next = {
      start: toISODateInput(getMonthStart(now)),
      end: toISODateInput(now),
    };
    setDateRange(next);
    setRangeError(null);
    if (users.length === 0) return;

    setIsApplyingRange(true);
    try {
      await Promise.all([
        fetchNotesCount(users, next),
        fetchRecordsCount(users, next),
      ]);
    } finally {
      setIsApplyingRange(false);
    }
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

      {/* Activity Report Section */}
      <div className="px-6 pb-6 mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            ACTIVITY REPORT
          </h2>

          {/* User Filter */}
          <div className="relative" ref={usersDropdownRef}>
            <button
              onClick={() => setIsUsersDropdownOpen(!isUsersDropdownOpen)}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="text-sm font-medium text-gray-700">
                {selectedUsers.length === 0
                  ? "All Users"
                  : selectedUsers.length === 1
                  ? users.find((u) => u.id === selectedUsers[0])?.name ||
                    "1 User"
                  : `${selectedUsers.length} Users`}
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  isUsersDropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isUsersDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <button
                    onClick={selectAllUsers}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
                  >
                    {selectedUsers.length === users.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div className="p-2">
                  {users.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No users available
                    </div>
                  ) : (
                    users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm text-gray-700">
                          {user.name || user.email}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="p-2 border-t border-gray-200">
                    <div className="px-3 py-2 text-xs text-gray-500">
                      {selectedUsers.length} user(s) selected
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Activity Report Grid */}
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          {/* Header Row */}
          <div className="flex bg-gray-50 border-b border-gray-300">
            <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              User
            </div>
            <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Category
            </div>
            <div className="w-24 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Notes
            </div>
            <div className="w-24 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 text-center">
              Notes Count
            </div>
            <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 text-center">
              Added to System
            </div>
            <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Inbound emails
            </div>
            <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Outbound emails
            </div>
            <div className="w-16 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Calls
            </div>
            <div className="w-16 p-3 text-sm font-medium text-gray-700">
              Texts
            </div>
          </div>

          {/* Data Rows */}
          {filteredGoalsQuotasData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {selectedUsers.length === 0
                ? "No goals/quotes data available"
                : "No goals/quotes found for selected users"}
            </div>
          ) : (
            filteredGoalsQuotasData.map((row, index) => {
              const rowClass = index % 2 === 0 ? "bg-white" : "bg-gray-50";
              return (
                <div
                  key={`${row.userId}-${row.category}`}
                  className={`flex border-b border-gray-300 last:border-b-0 ${rowClass}`}
                >
                  <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                    {row.userName}
                  </div>

                  <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                    {row.category}
                  </div>

                  {/* Notes (free text) */}
                  <div className="w-24 p-3 border-r border-gray-300">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => {
                        const updated = goalsQuotasData.map((item) =>
                          item.userId === row.userId &&
                          item.category === row.category
                            ? { ...item, notes: e.target.value }
                            : item
                        );
                        setGoalsQuotasData(updated);
                      }}
                      className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                      placeholder=""
                    />
                  </div>

                  {/* ✅ Notes Count clickable */}
                  <div className="w-24 p-3 border-r border-gray-300 text-center">
                    {isLoadingNotes ? (
                      <span className="text-gray-400">...</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleNotesClick(row.userId, row.category)
                        }
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                        title="Click to view notes"
                      >
                        {row.notesCount || 0}
                      </button>
                    )}
                  </div>

                  {/* ✅ Added to System clickable */}
                  <div className="w-32 p-3 border-r border-gray-300 text-center">
                    {isLoadingRecords ? (
                      <span className="text-gray-400">...</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleRecordsClick(row.userId, row.category)
                        }
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                        title="Click to view records"
                      >
                        {row.addedToSystem || 0}
                      </button>
                    )}
                  </div>

                  {/* static 0 columns */}
                  <div className="w-28 p-3 border-r border-gray-300">
                    <span className="text-sm text-gray-700">0</span>
                  </div>
                  <div className="w-28 p-3 border-r border-gray-300">
                    <span className="text-sm text-gray-700">0</span>
                  </div>
                  <div className="w-16 p-3 border-r border-gray-300">
                    <span className="text-sm text-gray-700">0</span>
                  </div>
                  <div className="w-16 p-3">
                    <span className="text-sm text-gray-700">0</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ✅ Notes Modal */}
      {showNotesModal && selectedNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Notes - {selectedNotes.category} -{" "}
                {users.find((u) => u.id === selectedNotes.userId)?.name ||
                  selectedNotes.userId}
              </h2>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedNotes(null);
                }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6">
              {selectedNotes.notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes found</p>
              ) : (
                <div className="space-y-3">
                  {selectedNotes.notes.map((note, idx) => (
                    <div
                      key={note.id || idx}
                      className="border border-gray-200 rounded p-4"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {note._entityName}
                      </div>
                      <div className="text-sm text-gray-700 mt-2">
                        {note.text || note.note || "(No text)"}
                      </div>
                      {note.created_at && (
                        <div className="text-xs text-gray-500 mt-2">
                          Created: {new Date(note.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total: {selectedNotes.notes.length} note(s)
              </div>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedNotes(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records Modal (existing) */}
      {showRecordsModal && selectedRecords && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {selectedRecords.category} Records -{" "}
                {users.find((u) => u.id === selectedRecords.userId)?.name ||
                  selectedRecords.userId}
              </h2>
              <button
                onClick={() => {
                  setShowRecordsModal(false);
                  setSelectedRecords(null);
                }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6">
              {selectedRecords.records.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No records found
                </p>
              ) : (
                <div className="space-y-4">
                  {selectedRecords.records.map((record, index) => (
                    <div
                      key={record.id || index}
                      className="border border-gray-200 rounded p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {selectedRecords.category === "Organization" && (
                            <>
                              <h3 className="font-medium text-gray-900">
                                {record.name || `Organization #${record.id}`}
                              </h3>
                              {record.website && (
                                <p className="text-sm text-gray-600">
                                  {record.website}
                                </p>
                              )}
                              {record.phone && (
                                <p className="text-sm text-gray-600">
                                  {record.phone}
                                </p>
                              )}
                            </>
                          )}

                          {selectedRecords.category === "Jobs" && (
                            <>
                              <h3 className="font-medium text-gray-900">
                                {record.job_title || `Job #${record.id}`}
                              </h3>
                              {record.organization_name && (
                                <p className="text-sm text-gray-600">
                                  {record.organization_name}
                                </p>
                              )}
                              {record.category && (
                                <p className="text-sm text-gray-600">
                                  Category: {record.category}
                                </p>
                              )}
                            </>
                          )}

                          {selectedRecords.category === "Job Seekers" && (
                            <>
                              <h3 className="font-medium text-gray-900">
                                {record.full_name ||
                                  `${record.first_name} ${record.last_name}` ||
                                  `Job Seeker #${record.id}`}
                              </h3>
                              {record.email && (
                                <p className="text-sm text-gray-600">
                                  {record.email}
                                </p>
                              )}
                              {record.phone && (
                                <p className="text-sm text-gray-600">
                                  {record.phone}
                                </p>
                              )}
                            </>
                          )}

                          {selectedRecords.category === "Hiring Managers" && (
                            <>
                              <h3 className="font-medium text-gray-900">
                                {record.full_name ||
                                  `${record.first_name} ${record.last_name}` ||
                                  `Hiring Manager #${record.id}`}
                              </h3>
                              {record.email && (
                                <p className="text-sm text-gray-600">
                                  {record.email}
                                </p>
                              )}
                              {record.title && (
                                <p className="text-sm text-gray-600">
                                  {record.title}
                                </p>
                              )}
                            </>
                          )}

                          {selectedRecords.category === "Placements" && (
                            <>
                              <h3 className="font-medium text-gray-900">
                                {record.job_seeker_name ||
                                  record.jobSeekerName ||
                                  `Placement #${record.id}`}
                              </h3>
                              {record.job_title && (
                                <p className="text-sm text-gray-600">
                                  {record.job_title}
                                </p>
                              )}
                              {record.status && (
                                <p className="text-sm text-gray-600">
                                  Status: {record.status}
                                </p>
                              )}
                            </>
                          )}

                          {selectedRecords.category === "Leads" && (
                            <>
                              <h3 className="font-medium text-gray-900">
                                {record.full_name ||
                                  `${record.first_name} ${record.last_name}` ||
                                  `Lead #${record.id}`}
                              </h3>
                              {record.email && (
                                <p className="text-sm text-gray-600">
                                  {record.email}
                                </p>
                              )}
                              {record.title && (
                                <p className="text-sm text-gray-600">
                                  {record.title}
                                </p>
                              )}
                            </>
                          )}

                          {record.created_at && (
                            <p className="text-xs text-gray-500 mt-2">
                              Created:{" "}
                              {new Date(record.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <div className="text-xs text-gray-500">
                          ID: {record.id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total: {selectedRecords.records.length} record(s)
              </div>
              <button
                onClick={() => {
                  setShowRecordsModal(false);
                  setSelectedRecords(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsAndQuotas;
