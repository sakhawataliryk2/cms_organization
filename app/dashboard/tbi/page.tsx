"use client";

import { useState } from "react";

export default function TbiPage() {
  // Row labels for the left column
  const rowLabels = [
    "Organization",
    "Hiring Manager",
    "Job Seeker",
    "Placements",
    "TimeSheets",
    "Exports",
    "Receivables",  
    "Messagesing",
    "From Office",
  ];

  // Column headers mapping for each row
  const columnHeadersMap: Record<string, string[]> = {
    "Organization": ["Name", "Oasis Key", "Organization ID", "Phone", "Email"],
    "Hiring Manager": ["Name", "Email", "Status", "Organization", "Hiring Manager", "ID #", "UserName"],
    "Job Seeker": ["Name", "Job Seeker ID", "Approved", "Submitted", "Status", "Payroll Cycle", "Phone Number", "Email"],
    "Placements": ["ID #", "JobSeeker", "Organization", "PO #", "Start Date", "End Date", "Placement Status", "Job Title"],
    "TimeSheets": ["Name", "JobSeeker ID", "Approved", "Submitted", "Status", "Payroll Cycle", "Phone Number", "Email"],
    "Exports": ["Export Name", "Date", "Type", "Status", "Records"],
    "Receivables": ["Invoice #", "Organization", "Amount", "Due Date", "Status"],
    "Messagesing": ["From", "To", "Subject", "Date", "Status"],
    "From Office": ["Name", "Email", "Status", "Organization", "Hiring Manager", "ID #", "UserName"],
  };

  // Default columns (for initial state or fallback)
  const defaultColumns = [
    "Job Code",
    "Regular Hours",
    "Paid Time Off",
    "On Call",
    "Expense",
    "Organization",
    "Personal ID",
    "Status",
    "FTE",
    "TIME",
    "Type",
    "Total",
    "Tuesday",
    "Friday",
    "Saturday",
    "Sunday",
    "Monday",
    "Time Off",
    "Vacation",
    "Sick Time",
  ];

  // State to track selected row
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  // Get current column headers based on selected row
  const getCurrentColumns = () => {
    if (selectedRow && columnHeadersMap[selectedRow]) {
      return columnHeadersMap[selectedRow];
    }
    return defaultColumns;
  };

  const columnHeaders = getCurrentColumns();

  // Handle row label click
  const handleRowClick = (rowLabel: string) => {
    setSelectedRow(rowLabel);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar - Dark Blue Grey */}
      <div className="bg-gray-700 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Grade Building System</h1>
          <span className="text-sm text-gray-300">v 1.0</span>
          <span className="text-sm text-gray-300">v 1.1</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Add New Button - Red */}
          <button className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
            Add New
          </button>
          {/* Menu Button - White */}
          <button className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
            Menu
          </button>
        </div>
      </div>

      {/* Main Grid Container - Scrollable */}
      <div className="overflow-auto max-h-[calc(100vh-80px)]">
        {/* Column Headers Row - Sticky */}
        <div className="flex sticky top-0 z-20">
          {/* Empty corner cell */}
          <div className="w-44 bg-gray-700 border-r-2 border-black flex-shrink-0 sticky left-0 z-30"></div>
          
          {/* Column Headers - Teal Buttons */}
          <div className="flex">
            {columnHeaders.map((header, index) => (
              <div
                key={index}
                className="bg-teal-500 text-white px-3 py-3 border-r border-black min-w-[130px] flex items-center justify-center font-medium text-sm rounded-t-lg shadow-sm"
              >
                {header}
              </div>
            ))}
          </div>
        </div>

        {/* Grid Rows */}
        <div className="flex flex-col">
          {rowLabels.map((rowLabel, rowIndex) => {
            const isSelected = selectedRow === rowLabel;
            return (
              <div key={rowIndex} className="flex">
                {/* Row Label (Left Column) - Teal Button, Sticky, Clickable */}
                <button
                  onClick={() => handleRowClick(rowLabel)}
                  className={`w-44 px-3 py-3 border-r-2 border-black border-b border-black flex items-center justify-center font-medium text-sm flex-shrink-0 sticky left-0 z-10 shadow-sm transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-teal-600 text-white"
                      : "bg-teal-500 text-white hover:bg-teal-600"
                  }`}
                >
                  {rowLabel}
                </button>

                {/* Grid Cells - Alternating Colors */}
                <div className="flex">
                  {columnHeaders.map((_, colIndex) => (
                    <div
                      key={colIndex}
                      className={`min-w-[130px] h-14 border-r border-b border-black flex items-center justify-center text-sm ${
                        rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      {/* Empty cell - ready for data input */}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
