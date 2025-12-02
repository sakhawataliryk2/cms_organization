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

  // Generate mock appointment counts for each day
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarData = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const appointmentCount = Math.floor(Math.random() * 25); // Random count 0-24
    calendarData.push({
      day,
      appointmentCount,
      isCurrentMonth: true,
      isToday: day === today.getDate(),
    });
  }

  return calendarData;
};

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

  const calendarData = getCalendarData();
  const selectedDayAppointments = mockAppointments; // In real app, filter by selected date

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      if (direction === "prev") {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  // const totalAppointments = calendarData.reduce(
  //   (sum, day) => sum + day.appointmentCount,
  //   0
  // );

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users/active");
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  // Close dropdown when clicking outside
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((user) => user.id));
    }
  };

  return (
    <div className="min-h-screen bg-white">
      

      {/* Activity Report Section */}
      <div className="px-6 pb-6 mt-8">
        {/* Activity Report Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            ACTIVITY REPORT
          </h2>
        </div>

        {/* Activity Report Grid */}
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          {/* Header Row */}
          <div className="flex bg-gray-50 border-b border-gray-300">
            <div className="w-32 p-3 border-r border-gray-300"></div>
            <div className="w-24 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Notes
            </div>
            {/* <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              <div>Goals</div>
              <div className="text-xs font-normal text-gray-500">Quotas</div>
            </div> */}
            <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Added to System
            </div>
            {/* <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              <div>Goals</div>
              <div className="text-xs font-normal text-gray-500">Quotas</div>
            </div> */}
            <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Inbound emails
            </div>
            {/* <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              <div>Goals</div>
              <div className="text-xs font-normal text-gray-500">Quotas</div>
            </div> */}
            <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Outbound emails
            </div>
            {/* <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              <div>Goals</div>
              <div className="text-xs font-normal text-gray-500">Quotas</div>
            </div> */}
            <div className="w-16 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              Calls
            </div>
            {/* <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
              <div>Goals</div>
              <div className="text-xs font-normal text-gray-500">Quotas</div>
            </div> */}
            <div className="w-16 p-3 text-sm font-medium text-gray-700">
              Texts
            </div>
          </div>

          {/* Data Rows */}
          {[
            { category: "Organization", rowClass: "bg-white" },
            { category: "Jobs", rowClass: "bg-gray-50" },
            { category: "Job Seekers", rowClass: "bg-white" },
            { category: "Hiring Managers", rowClass: "bg-gray-50" },
            { category: "Placements", rowClass: "bg-white" },
            { category: "Leads", rowClass: "bg-gray-50" },
          ].map((row, index) => (
            <div
              key={index}
              className={`flex border-b border-gray-300 last:border-b-0 ${row.rowClass}`}
            >
              {/* Category Name */}
              <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                {row.category}
              </div>

              {/* Notes Column */}
              <div className="w-24 p-3 border-r border-gray-300">
                <input
                  type="text"
                  className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder=""
                />
              </div>

              {/* Notes - Goals/Quotas */}
              {/* <div className="w-20 p-3 border-r border-gray-300">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder=""
                  />
                  <input 
                    type="number" 
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                    placeholder=""
                  />
                </div>
              </div> */}

              {/* Added to System Column */}
              <div className="w-32 p-3 border-r border-gray-300">
                <input
                  type="number"
                  className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder=""
                />
              </div>

              {/* Added to System - Goals/Quotas */}
              {/* <div className="w-20 p-3 border-r border-gray-300">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder=""
                  />
                  <input 
                    type="number" 
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                    placeholder="0"
                  />
                </div>
              </div> */}

              {/* Inbound emails Column */}
              <div className="w-28 p-3 border-r border-gray-300">
                <input
                  type="number"
                  className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder=""
                />
              </div>

              {/* Inbound emails - Goals/Quotas */}
              {/* <div className="w-20 p-3 border-r border-gray-300">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder=""
                  />
                  <input 
                    type="number" 
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                    placeholder=""
                  />
                </div>
              </div> */}

              {/* Outbound emails Column */}
              <div className="w-28 p-3 border-r border-gray-300">
                <input
                  type="number"
                  className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder=""
                />
              </div>

              {/* Outbound emails - Goals/Quotas */}
              {/* <div className="w-20 p-3 border-r border-gray-300">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder=""
                  />
                  <input 
                    type="number" 
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                      placeholder=""
                  />
                </div>
              </div> */}

              {/* Calls Column */}
              <div className="w-16 p-3 border-r border-gray-300">
                <input
                  type="number"
                  className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder=""
                />
              </div>

              {/* Calls - Goals/Quotas */}
              {/* <div className="w-20 p-3 border-r border-gray-300">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    placeholder=""
                  />
                  <input 
                    type="number" 
                    className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                    placeholder=""
                  />
                </div>
              </div> */}

              {/* Texts Column */}
              <div className="w-16 p-3">
                <input
                  type="number"
                  className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder=""
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GoalsAndQuotas;
