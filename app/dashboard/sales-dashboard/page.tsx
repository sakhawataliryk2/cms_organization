'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiX, FiTrendingUp, FiDollarSign, FiUsers, FiBriefcase } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export default function SalesDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    // Handle close/return to home
    const handleClose = () => {
        router.push('/dashboard');
    };

    // Handle previous navigation
    const handlePrevious = () => {
        router.push('/dashboard/candidate-flow');
    };

    // Sample sales data
    const salesMetrics = [
        { label: 'Total Revenue', value: '$125,000', change: '+12.5%', trend: 'up' },
        { label: 'Active Deals', value: '24', change: '+3', trend: 'up' },
        { label: 'Conversion Rate', value: '18.5%', change: '+2.1%', trend: 'up' },
        { label: 'Avg Deal Size', value: '$5,200', change: '-$200', trend: 'down' },
    ];

    const recentDeals = [
        { id: 1, company: 'Tech Corp', value: '$15,000', stage: 'Proposal', probability: '75%' },
        { id: 2, company: 'Startup Inc', value: '$8,500', stage: 'Negotiation', probability: '60%' },
        { id: 3, company: 'Consulting Firm', value: '$22,000', stage: 'Closed Won', probability: '100%' },
        { id: 4, company: 'Finance Co', value: '$12,000', stage: 'Qualified', probability: '40%' },
    ];

    const topPerformers = [
        { name: 'John Smith', revenue: '$45,000', deals: 8 },
        { name: 'Jane Doe', revenue: '$38,000', deals: 6 },
        { name: 'Mike Johnson', revenue: '$32,000', deals: 5 },
    ];

    return (
        <div className="flex flex-col h-full relative">
            {/* X button in top right corner */}
            <button
                onClick={handleClose}
                className="absolute top-2 right-2 z-10 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close and return to home"
            >
                <FiX size={24} />
            </button>

            {/* Header */}
            <div className="bg-white border-b border-gray-300 p-4 mb-4">
                <h1 className="text-2xl font-bold text-gray-800">Sales Dashboard</h1>
                <p className="text-gray-600 mt-1">Overview of sales performance and metrics</p>
            </div>

            {/* Main content */}
            <div className="flex-grow overflow-auto p-4">
                {/* Sales Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {salesMetrics.map((metric, index) => (
                        <div key={index} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-600">{metric.label}</h3>
                                {metric.trend === 'up' ? (
                                    <FiTrendingUp className="text-green-500" size={20} />
                                ) : (
                                    <FiTrendingUp className="text-red-500 rotate-180" size={20} />
                                )}
                            </div>
                            <div className="text-2xl font-bold text-gray-800 mb-1">{metric.value}</div>
                            <div className={`text-sm ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                {metric.change}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Deals */}
                    <div className="bg-white rounded-lg shadow border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                <FiBriefcase className="mr-2" />
                                Recent Deals
                            </h2>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3">
                                {recentDeals.map((deal) => (
                                    <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-800">{deal.company}</div>
                                            <div className="text-sm text-gray-600">{deal.stage}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-gray-800">{deal.value}</div>
                                            <div className="text-sm text-gray-600">{deal.probability}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Top Performers */}
                    <div className="bg-white rounded-lg shadow border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                <FiUsers className="mr-2" />
                                Top Performers
                            </h2>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3">
                                {topPerformers.map((performer, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold mr-3">
                                                {performer.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-800">{performer.name}</div>
                                                <div className="text-sm text-gray-600">{performer.deals} deals</div>
                                            </div>
                                        </div>
                                        <div className="font-semibold text-gray-800">{performer.revenue}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sales Chart Placeholder */}
                <div className="mt-6 bg-white rounded-lg shadow border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FiTrendingUp className="mr-2" />
                        Sales Trend
                    </h2>
                    <div className="h-64 bg-gray-50 rounded flex items-center justify-center border-2 border-dashed border-gray-300">
                        <div className="text-center text-gray-500">
                            <FiDollarSign size={48} className="mx-auto mb-2" />
                            <p>Sales chart visualization</p>
                            <p className="text-sm mt-1">Chart component would be integrated here</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-end p-4 border-t border-gray-300 bg-white">
                <div className="flex space-x-4">
                    <div className="text-right">
                        <div className="text-lg mb-1 text-gray-700">Previous</div>
                        <button
                            onClick={handlePrevious}
                            className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded flex items-center justify-center transition-colors"
                        >
                            <span className="transform -translate-x-1">◀</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

