'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  initializeOffice365Auth,
  isOffice365Authenticated,
  syncCalendarEventToOffice365,
  getOffice365CalendarEvents,
  disconnectOffice365,
  type CalendarEvent,
} from '@/lib/office365';

// Mock data for appointments
const mockAppointments = [
  {
    id: 1,
    time: '0',
    type: '0',
    client: '0',
    job: '0',
    references: ['0'],
    owner: '0'
  },
  {
    id: 2,
    time: '0',
    type: '0',
    client: '0',
    job: '0',
    references: ['0'],
    owner: '0'
  },
  {
    id: 3,
    time: '0',
    type: '0',
    client: '0',
    job: '0',
    references: ['0'],
    owner: '0'
  },
  {
    id: 4,
    time: '0',
    type: '0',
    client: '0',
    job: '0',
    references: ['0'],
    owner: '0'
  },
  {
    id: 5,
    time: '0',
    type: '0',
    client: '0',
    job: '0',
    references: ['0'],
    owner: '0'
  }
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
    const appointmentCount = 0; // Set to 0 to hide numbers
    calendarData.push({
      day,
      appointmentCount,
      isCurrentMonth: true,
      isToday: day === today.getDate()
    });
  }
  
  return calendarData;
};

const Planners = () => {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewType, setViewType] = useState('Month');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOffice365Connected, setIsOffice365Connected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  
  const calendarData = getCalendarData();
  const selectedDayAppointments = mockAppointments; // In real app, filter by selected date

  // Check Office 365 connection status on mount
  useEffect(() => {
    const checkConnection = () => {
      const connected = isOffice365Authenticated();
      setIsOffice365Connected(connected);
      
      // Check URL for connection status
      if (typeof window !== 'undefined') {
        const connectedParam = searchParams.get('connected');
        const errorParam = searchParams.get('error');
        
        if (connectedParam === 'true') {
          setIsOffice365Connected(true);
          setSyncStatus('Successfully connected to Office 365!');
          // Clear URL params
          window.history.replaceState({}, '', '/dashboard/planner');
        }
        
        if (errorParam) {
          setSyncStatus(`Connection error: ${errorParam}`);
          // Clear URL params
          window.history.replaceState({}, '', '/dashboard/planner');
        }
      }
    };

    checkConnection();
    // Also check in sessionStorage
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('msal_access_token');
      if (token) setIsOffice365Connected(true);
    }
  }, [searchParams]);

  // Handle Office 365 connection
  const handleConnectOffice365 = async () => {
    try {
      await initializeOffice365Auth();
    } catch (error: any) {
      setSyncStatus(`Failed to connect: ${error.message}`);
      console.error('Error connecting to Office 365:', error);
    }
  };

  // Handle Office 365 disconnection
  const handleDisconnectOffice365 = () => {
    disconnectOffice365();
    setIsOffice365Connected(false);
    setSyncStatus('Disconnected from Office 365');
  };

  // Sync appointments to Office 365
  const handleSyncToOffice365 = async () => {
    if (!isOffice365Connected) {
      alert('Please connect to Office 365 first');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Syncing appointments to Office 365...');

    try {
      let syncedCount = 0;
      const errors: string[] = [];

      for (const appointment of selectedDayAppointments) {
        try {
          // Format appointment as calendar event
          const eventDate = new Date(selectedDate);
          const [hours, minutes] = appointment.time.replace(/AM|PM/, '').trim().split(':');
          let hour = parseInt(hours);
          const isPM = appointment.time.includes('PM');
          if (isPM && hour !== 12) hour += 12;
          if (!isPM && hour === 12) hour = 0;
          
          eventDate.setHours(hour, parseInt(minutes), 0, 0);
          const endDate = new Date(eventDate);
          endDate.setMinutes(endDate.getMinutes() + 30); // Default 30 min meeting

          const calendarEvent: CalendarEvent = {
            subject: `${appointment.type} - ${appointment.client} - ${appointment.job}`,
            start: {
              dateTime: eventDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            body: {
              contentType: 'Text',
              content: `Type: ${appointment.type}\nClient: ${appointment.client}\nJob: ${appointment.job}\nOwner: ${appointment.owner}\nReferences: ${appointment.references.join(', ')}`,
            },
          };

          await syncCalendarEventToOffice365(calendarEvent);
          syncedCount++;
        } catch (error: any) {
          errors.push(`${appointment.client}: ${error.message}`);
        }
      }

      if (syncedCount > 0) {
        setSyncStatus(`Successfully synced ${syncedCount} appointment(s) to Office 365 calendar`);
      }
      if (errors.length > 0) {
        setSyncStatus(`Synced ${syncedCount} appointment(s), but ${errors.length} failed. ${errors.join('; ')}`);
      }
    } catch (error: any) {
      setSyncStatus(`Sync failed: ${error.message}`);
      console.error('Error syncing to Office 365:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch appointments from Office 365
  const handleFetchFromOffice365 = async () => {
    if (!isOffice365Connected) {
      alert('Please connect to Office 365 first');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Fetching appointments from Office 365...');

    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const events = await getOffice365CalendarEvents(
        startOfMonth.toISOString(),
        endOfMonth.toISOString()
      );

      setSyncStatus(`Fetched ${events.length} event(s) from Office 365 calendar`);
      // In a real app, you would update the local appointments state here
      console.log('Office 365 events:', events);
    } catch (error: any) {
      setSyncStatus(`Failed to fetch events: ${error.message}`);
      console.error('Error fetching from Office 365:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
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
  
  return (
    <div className="min-h-screen bg-white">
      {/* Sync Status Message */}
      {syncStatus && (
        <div className={`px-6 py-3 ${
          syncStatus.includes('Success') || syncStatus.includes('Fetched')
            ? 'bg-green-100 text-green-800'
            : syncStatus.includes('error') || syncStatus.includes('Failed')
            ? 'bg-red-100 text-red-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{syncStatus}</span>
            <button
              onClick={() => setSyncStatus('')}
              className="text-sm hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      
      {/* Header/Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
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
            {/* Office 365 Sync Section */}
            <div className="flex items-center space-x-2">
              {isOffice365Connected ? (
                <>
                  <span className="text-sm text-green-600 font-medium flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Office 365</span>
                  </span>
                  <button
                    onClick={handleSyncToOffice365}
                    disabled={isSyncing}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded text-sm flex items-center space-x-1"
                    title="Sync appointments to Office 365 calendar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>{isSyncing ? 'Syncing...' : 'Sync to Calendar'}</span>
                  </button>
                  <button
                    onClick={handleFetchFromOffice365}
                    disabled={isSyncing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded text-sm flex items-center space-x-1"
                    title="Fetch appointments from Office 365 calendar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{isSyncing ? 'Loading...' : 'Fetch from Calendar'}</span>
                  </button>
                  <button
                    onClick={handleDisconnectOffice365}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm"
                    title="Disconnect Office 365"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectOffice365}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  title="Connect to Office 365"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span>Connect Office 365</span>
                </button>
              )}
            </div>
            
            {/* Add Button */}
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>ADD</span>
            </button>
            
            {/* Dropdowns */}
            {/* <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span>Types (9)</span>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div> */}
            
            {/* <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span>Users (145)</span>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div> */}
            
            {/* View Type Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['Month', 'Week', 'Day', 'List'].map((view) => (
                <button
                  key={view}
                  onClick={() => setViewType(view)}
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
            
            {/* List Icon */}
            <button className="p-2 text-gray-600 hover:text-gray-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
              onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayData.day))}
            >
              <div className="flex flex-col h-full">
                <div className={`text-sm ${
                  dayData.isToday ? 'text-blue-600 font-semibold' : 'text-gray-500'
                }`}>
                  {dayData.day}
                </div>
                {dayData.appointmentCount > 0 && (
                  <div className={`text-lg font-bold underline mt-1 ${
                    dayData.isToday ? 'text-blue-600' : 'text-blue-500'
                  }`}>
                    {dayData.appointmentCount}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Appointment Details Section */}
      <div className="px-6 pb-6">
        {/* Selected Day Header */}
        {/* <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold">
              {selectedDate.getDate()} {dayNames[selectedDate.getDay()]}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span>{selectedDayAppointments.length} Appointments</span>
            <div className="flex items-center space-x-1">
              <button className="px-2 py-1 text-blue-200 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button className="px-2 py-1 bg-white text-blue-600 rounded font-medium">1</button>
              <button className="px-2 py-1 text-blue-200 hover:text-white">2</button>
              <button className="px-2 py-1 text-blue-200 hover:text-white">3</button>
              <button className="px-2 py-1 text-blue-200 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div> */}
        
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
              {/* {selectedDayAppointments.map((appointment, index) => (
                <tr key={appointment.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        VIEW
                      </button>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{appointment.time}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.client}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.job}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {appointment.references.map((reference, refIndex) => (
                        <div key={refIndex} className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            refIndex === 0 ? 'bg-green-500' : 'bg-orange-500'
                          }`}></div>
                          <span className="text-blue-600 hover:text-blue-800 underline text-sm">
                            {reference}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{appointment.owner}</td>
                </tr>
              ))} */}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Planners;