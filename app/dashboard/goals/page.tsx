"use client";

import React, { useState, useEffect } from "react";

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

  const totalAppointments = calendarData.reduce(
    (sum, day) => sum + day.appointmentCount,
    0
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side */}
          <div className="flex items-center space-x-4">
            {/* Calendar Icon */}
            <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth("prev")}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-lg font-medium text-gray-900">
                {monthNames[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </span>
              <button
                onClick={() => navigateMonth("next")}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Total Appointments */}
            <div className="text-sm text-gray-600">
              {totalAppointments} APPOINTMENTS
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Add Button */}
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>ADD</span>
            </button>

            {/* Dropdowns */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Types (9)</span>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span>Users (145)</span>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* View Type Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {["Month", "Week", "Day", "List"].map((view) => (
                <button
                  key={view}
                  onClick={() => setViewType(view)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    viewType === view
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>

            {/* List Icon */}
            <button className="p-2 text-gray-600 hover:text-gray-800">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-6 py-6">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-gray-600 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarData.map((dayData, index) => (
            <div
              key={index}
              className={`min-h-[80px] border border-gray-200 p-2 cursor-pointer hover:bg-gray-50 ${
                dayData.isToday ? "bg-blue-100 border-blue-300" : ""
              }`}
              onClick={() =>
                setSelectedDate(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth(),
                    dayData.day
                  )
                )
              }
            >
              <div className="flex flex-col h-full">
                <div
                  className={`text-sm ${
                    dayData.isToday
                      ? "text-blue-600 font-semibold"
                      : "text-gray-500"
                  }`}
                >
                  {dayData.day}
                </div>
                <div
                  className={`text-lg font-bold underline mt-1 ${
                    dayData.isToday ? "text-blue-600" : "text-blue-500"
                  }`}
                >
                  {dayData.appointmentCount}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
