'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiSearch, FiChevronDown, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Navigation handlers
    const handleNextClick = () => {
        router.push('/dashboard/candidate-flow');
    };

    // Calendar days of week
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Calendar dates
    const calendarDates = [
        [1, 2, 3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26, 27, 28],
        [29, 30, 31, 1, 2, 3, 4]
    ];

    // Days with events (Saturdays)
    const eventDays = [7, 14, 21, 28];

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow mb-4">
                {/* Appointments Calendar */}
                <div className="bg-white rounded-md shadow overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Appointments</h2>
                    </div>
                    <div className="p-4">
                        {/* Calendar header */}
                        <div className="grid grid-cols-7 mb-2">
                            {daysOfWeek.map((day, index) => (
                                <div key={index} className="text-center py-2 text-gray-500">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        {calendarDates.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-7 mb-1">
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={dayIndex}
                                        className={`text-center py-3 ${eventDays.includes(day) ? 'bg-blue-100' : ''}`}
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* Event button */}
                        <div className="mt-4">
                            <button className="w-full bg-blue-500 text-white py-3 rounded-md">
                                Event
                            </button>
                        </div>

                        {/* Available text */}
                        <div className="mt-6 text-center text-gray-400">
                            Available
                        </div>
                    </div>
                </div>

                {/* Middle - Tasks */}
                <div className="bg-white rounded-md shadow overflow-hidden">
                    <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-semibold">Tasks Overview</h2>
                        </div>
                        <div>
                            {/* Header buttons would go here */}
                        </div>
                    </div>
                    <div className="p-4 flex flex-col items-center justify-center h-full">
                        {/* Empty state */}
                        <div className="text-center">
                            <div className="bg-gray-200 rounded-full p-4 inline-flex mx-auto mb-4">
                                <FiSearch size={24} className="text-gray-500" />
                            </div>
                            <p className="text-gray-600">Hmm... Your search didn't return any results.</p>
                            <p className="text-gray-400 text-sm mt-2">
                                Make sure everything is spelled correctly or try different keywords.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col space-y-4">
                    {/* Goals and Quotas */}
                    <div className="bg-white rounded-md shadow overflow-hidden">
                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <h2 className="text-lg font-semibold">Goals and Quotas</h2>
                                <button className="bg-blue-500 text-white px-2 py-1 rounded text-xs">
                                    Goal
                                </button>
                                <button className="bg-gray-100 border border-gray-300 px-2 py-1 rounded text-xs">
                                    QUOTA
                                </button>
                                <div className="flex items-center">
                                    <button className="bg-gray-100 border border-gray-300 px-2 py-1 rounded-l text-xs">
                                        Filters
                                    </button>
                                    <button className="bg-gray-100 border border-gray-300 border-l-0 px-2 py-1 rounded-r text-xs">
                                        <FiChevronDown size={14} />
                                    </button>
                                </div>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                            {/* Empty state */}
                            <div className="text-center">
                                <div className="bg-gray-200 rounded-full p-4 inline-flex mx-auto mb-4">
                                    <FiSearch size={24} className="text-gray-500" />
                                </div>
                                <p className="text-gray-600">Hmm... Your search didn't return any results.</p>
                                <p className="text-gray-400 text-sm mt-2">
                                    Make sure everything is spelled correctly or try different keywords.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Rules of Engagement */}
                    <div className="bg-white rounded-md shadow overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Rules of engagement</h2>
                        </div>
                        <div className="p-6 flex justify-center">
                            <div className="bg-blue-500 rounded-md p-4 w-28 h-28 flex flex-col items-center justify-center text-white">
                                <div className="bg-white w-10 h-10 mb-2"></div>
                                <div className="text-center">
                                    <div className="text-sm">Rules of</div>
                                    <div className="text-sm">Engagement</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            {/* <div className="grid grid-cols-12 gap-4 mt-4">
                
                <div className="col-span-12 md:col-span-6 lg:col-span-4">
                    <div className="bg-gray-50 p-4">
                        <h2 className="font-bold mb-4">Select Date and Time Range</h2>

                        <div className="mb-4">
                            <label className="block mb-1">Start Date & Time:</label>
                            <input
                                type="text"
                                placeholder="Select start date and time"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block mb-1">End Date & Time:</label>
                            <input
                                type="text"
                                placeholder="Select end date and time"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>


                </div>

                
                <div className="hidden md:block md:col-span-2 lg:col-span-4"></div>

                
                <div className="col-span-12 md:col-span-4 lg:col-span-4 flex items-end justify-end">
                    <div className="text-right">
                        <div className="text-lg mb-1">Next</div>
                        <button
                            className="bg-teal-600 text-white w-24 h-10 rounded flex items-center justify-center"
                            onClick={handleNextClick}
                        >
                            <span className="transform translate-x-1">▶</span>
                        </button>
                    </div>
                </div>
            </div> */}
        </div>
    );
}