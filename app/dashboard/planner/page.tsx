'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiX, FiPrinter, FiLock, FiUnlock } from 'react-icons/fi';

interface Appointment {
  id: number;
  date: string;
  time: string;
  type: string;
  client: string;
  job: string;
  references: string[];
  owner: string;
  description?: string;
  location?: string;
  duration?: number;
}

const Planners = () => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewType, setViewType] = useState<'Month' | 'Week' | 'Day' | 'List'>('Month');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPinned, setIsPinned] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    date: '',
    time: '',
    type: '',
    client: '',
    job: '',
    description: '',
    location: '',
    duration: 30,
    owner: '',
  });
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);

  // Load pinned state from localStorage
  useEffect(() => {
    const pinned = localStorage.getItem('plannerPinned');
    if (pinned === 'true') {
      setIsPinned(true);
    }
  }, []);

  // Fetch appointments from API
  const fetchAppointments = async () => {
    setIsLoadingAppointments(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const queryParams = new URLSearchParams({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0],
      });

      const response = await fetch(`/api/planner/appointments?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      const appointmentsList = data.appointments || data.data || [];
      
      // Map API response to Appointment interface
      const mappedAppointments: Appointment[] = appointmentsList.map((apt: any) => ({
        id: apt.id,
        date: apt.date || apt.start_date || '',
        time: apt.time || '',
        type: apt.type || '',
        client: apt.client || apt.organization_name || '',
        job: apt.job || apt.job_title || '',
        references: apt.references || [],
        owner: apt.owner || apt.created_by_name || '',
        description: apt.description || '',
        location: apt.location || '',
        duration: apt.duration || 30,
      }));

      setAppointments(mappedAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [currentMonth]);

  // Calendar data generation
  const getCalendarData = (currentMonth: Date) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const daysFromPrevMonth = firstDayOfWeek;
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarData: Array<{ day: number; appointmentCount: number; isCurrentMonth: boolean; isToday: boolean; date: Date }> = [];
    
    // Add days from previous month
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      const dayAppointments = appointments.filter(apt => apt.date === dateString);
      
      calendarData.push({
        day,
        appointmentCount: dayAppointments.length,
        isCurrentMonth: false,
        isToday: false,
        date
      });
    }
    
    // Add days from current month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const dayAppointments = appointments.filter(apt => apt.date === dateString);
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
      
      calendarData.push({
        day,
        appointmentCount: dayAppointments.length,
        isCurrentMonth: true,
        isToday,
        date
      });
    }
    
    // Add days from next month to fill the grid (42 days total for 6 weeks)
    const remainingDays = 42 - calendarData.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateString = date.toISOString().split('T')[0];
      const dayAppointments = appointments.filter(apt => apt.date === dateString);
      
      calendarData.push({
        day,
        appointmentCount: dayAppointments.length,
        isCurrentMonth: false,
        isToday: false,
        date
      });
    }
    
    return calendarData;
  };

  const calendarData = getCalendarData(currentMonth);
  const selectedDayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return aptDate.toDateString() === selectedDate.toDateString();
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };
  
  const totalAppointments = calendarData.reduce((sum, day) => sum + day.appointmentCount, 0);

  // Handle Add Appointment
  const handleAddClick = () => {
    const today = new Date();
    setAppointmentForm({
      date: today.toISOString().split('T')[0],
      time: '',
      type: '',
      client: '',
      job: '',
      description: '',
      location: '',
      duration: 30,
      owner: '',
    });
    setShowAddModal(true);
  };

  // Handle Save Appointment
  const handleSaveAppointment = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      alert('Please fill in all required fields (Date, Time, Type)');
      return;
    }

    setIsSavingAppointment(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

      const response = await fetch('/api/planner/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: appointmentForm.date,
          time: appointmentForm.time,
          type: appointmentForm.type,
          client: appointmentForm.client,
          job: appointmentForm.job,
          description: appointmentForm.description,
          location: appointmentForm.location,
          duration: appointmentForm.duration,
          owner: appointmentForm.owner,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create appointment');
      }

      setShowAddModal(false);
      fetchAppointments();
    } catch (err) {
      console.error('Error saving appointment:', err);
      alert(err instanceof Error ? err.message : 'Failed to save appointment');
    } finally {
      setIsSavingAppointment(false);
    }
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  // Handle Close
  const handleClose = () => {
    router.push('/dashboard');
  };

  // Handle Pin Toggle
  const handlePinToggle = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);
    localStorage.setItem('plannerPinned', newPinnedState ? 'true' : 'false');
  };

  // Get appointments for List view (sorted chronologically)
  const getListAppointments = () => {
    const sorted = [...appointments].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  };

  // Render Week View
  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDays.push(date);
    }

    return (
      <div className="px-6 py-6">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((date, index) => {
            const dateString = date.toISOString().split('T')[0];
            const dayAppointments = appointments.filter(apt => apt.date === dateString);
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`min-h-[400px] border border-gray-200 p-2 ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {dayNames[date.getDay()]}
                </div>
                <div className={`text-lg font-bold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayAppointments.map(apt => (
                    <div key={apt.id} className="p-1 bg-blue-100 rounded text-xs">
                      <div className="font-medium">{apt.time}</div>
                      <div>{apt.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Day View
  const renderDayView = () => {
    const dateString = selectedDate.toISOString().split('T')[0];
    const dayAppointments = appointments.filter(apt => apt.date === dateString);
    const isToday = selectedDate.toDateString() === new Date().toDateString();

    return (
      <div className="px-6 py-6">
        <div className={`border border-gray-200 p-4 rounded ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}>
          <div className={`text-lg font-bold mb-4 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
            {dayNames[selectedDate.getDay()]}, {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </div>
          <div className="space-y-2">
            {dayAppointments.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No appointments for this day</div>
            ) : (
              dayAppointments.map(apt => (
                <div key={apt.id} className="border border-gray-200 p-3 rounded bg-white">
                  <div className="font-medium text-lg">{apt.time} - {apt.type}</div>
                  {apt.client && <div className="text-gray-600">Client: {apt.client}</div>}
                  {apt.job && <div className="text-gray-600">Job: {apt.job}</div>}
                  {apt.location && <div className="text-gray-600">Location: {apt.location}</div>}
                  {apt.description && <div className="text-gray-600 mt-2">{apt.description}</div>}
                  {apt.owner && <div className="text-gray-500 text-sm mt-2">Owner: {apt.owner}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render List View
  const renderListView = () => {
    const listAppointments = getListAppointments();
    const totalPages = Math.ceil(appointments.length / itemsPerPage);

    return (
      <div className="px-6 pb-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Client</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Job</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Owner</th>
              </tr>
            </thead>
            <tbody>
              {listAppointments.map((appointment, index) => (
                <tr key={appointment.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(appointment.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.time}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.client}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.job}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-white relative">
        {/* Header/Navigation Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 no-print">
          <div className="flex items-center justify-between">
            {/* Left Side */}
            <div className="flex items-center space-x-4">
              {/* Calendar Icon */}
              <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              
              {/* Month Navigation */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-lg font-medium text-gray-900">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button 
                  onClick={() => navigateMonth('next')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
              <button 
                onClick={handleAddClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>ADD</span>
              </button>
              
              {/* View Type Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['Month', 'Week', 'Day', 'List'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => {
                      setViewType(view);
                      if (view === 'Week' || view === 'Day') {
                        setSelectedDate(new Date());
                      }
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      viewType === view
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              
              {/* Action Icons */}
              <div className="flex items-center space-x-2">
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
          </div>
        </div>

        {/* Calendar Content */}
        {viewType === 'Month' && (
          <div className="px-6 py-6">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
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
                    dayData.isToday ? 'bg-blue-100 border-blue-300' : ''
                  }`}
                  onClick={() => setSelectedDate(dayData.date)}
                >
                  <div className="flex flex-col h-full">
                    <div className={`text-sm ${
                      dayData.isToday ? 'text-blue-600 font-semibold' : dayData.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                    }`}>
                      {dayData.day}
                    </div>
                    <div className={`text-lg font-bold underline mt-1 ${
                      dayData.isToday ? 'text-blue-600' : dayData.isCurrentMonth ? 'text-blue-500' : 'text-gray-300'
                    }`}>
                      {dayData.appointmentCount || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewType === 'Week' && renderWeekView()}
        {viewType === 'Day' && renderDayView()}
        {viewType === 'List' && renderListView()}

        {/* Appointment Details Section (Month View Only) */}
        {viewType === 'Month' && (
          <div className="px-6 pb-6 no-print">
            {/* Items Per Page */}
            <div className="bg-gray-50 px-4 py-2 border-x border-gray-200">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>ITEMS PER PAGE:</span>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            
            {/* Appointments Table */}
            <div className="bg-white border border-gray-200 rounded-b-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Client</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Job</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">References</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No appointments for selected date
                      </td>
                    </tr>
                  ) : (
                    selectedDayAppointments.map((appointment, index) => (
                      <tr key={appointment.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-600">{appointment.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{appointment.client}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{appointment.job}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {appointment.references.join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{appointment.owner}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center px-4 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold text-gray-800">Add Appointment</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={appointmentForm.date}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={appointmentForm.time}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={appointmentForm.type}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select type</option>
                  <option value="Interview">Interview</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Assessment">Assessment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <input
                  type="text"
                  value={appointmentForm.client}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, client: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Job */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                <input
                  type="text"
                  value={appointmentForm.job}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, job: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={appointmentForm.location}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={appointmentForm.description}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={appointmentForm.duration}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                  min="15"
                  step="15"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Owner */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <input
                  type="text"
                  value={appointmentForm.owner}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, owner: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={isSavingAppointment}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAppointment}
                disabled={isSavingAppointment || !appointmentForm.date || !appointmentForm.time || !appointmentForm.type}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingAppointment ? 'Saving...' : 'Save Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Planners;
