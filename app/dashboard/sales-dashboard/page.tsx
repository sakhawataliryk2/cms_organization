'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { HiEye } from 'react-icons/hi';

interface ApplicationTile {
    id: number;
    companyName: string;
    jobId: string;
    jobName: string;
    viewCount: number;
    candidateId?: number;
}

interface Column {
    id: string;
    title: string;
    color: string;
    applications: ApplicationTile[];
}

export default function SalesDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    // Sample data matching the screenshot design
    const [columns, setColumns] = useState<Column[]>([
        {
            id: 'submission',
            title: 'Submission',
            color: 'bg-green-200', // Light green
            applications: [
                { id: 1, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 5 },
                { id: 2, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 3 },
                { id: 3, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 7 },
                { id: 4, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 2 },
                { id: 5, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 4 },
            ]
        },
        {
            id: 'client-submitted',
            title: 'Client Submitted',
            color: 'bg-blue-200', // Light blue
            applications: [
                { id: 6, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 8 },
                { id: 7, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 6 },
                { id: 8, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 9 },
                { id: 9, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 1 },
            ]
        },
        {
            id: 'interview',
            title: 'Interview',
            color: 'bg-green-500', // Green (darker)
            applications: [
                { id: 10, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 12 },
                { id: 11, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 15 },
                { id: 12, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 10 },
            ]
        },
        {
            id: 'offer-extended',
            title: 'Offer Extended',
            color: 'bg-orange-400', // Orange
            applications: [
                { id: 13, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 20 },
                { id: 14, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 18 },
                { id: 15, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 22 },
                { id: 16, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 19 },
            ]
        },
        {
            id: 'placement',
            title: 'Placement',
            color: 'bg-green-700', // Dark green
            applications: [
                { id: 17, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 25 },
                { id: 18, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 30 },
                { id: 19, companyName: 'Company Name', jobId: 'Job ID #', jobName: 'Job Name', viewCount: 28 },
            ]
        }
    ]);

    // Handle close/return to home
    const handleClose = () => {
        router.push('/home');
    };

    // Handle previous navigation
    const handlePrevious = () => {
        router.push('/dashboard/candidate-flow');
    };

    // Handle tile click - navigate to candidate profile
    const handleTileClick = (application: ApplicationTile) => {
        if (application.candidateId) {
            router.push(`/dashboard/job-seekers/view?id=${application.candidateId}`);
        } else {
            // If no candidate ID, you could navigate to a generic page or show a message
            console.log('Navigate to candidate profile for:', application);
        }
    };

    // Handle save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save logic here - update application stages
            // This would typically make an API call to save the current state
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
            alert('Changes saved successfully');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error saving changes');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle moving application between columns (drag and drop would be implemented here)
    const moveApplication = (applicationId: number, fromColumnId: string, toColumnId: string) => {
        setColumns(prevColumns => {
            const newColumns = [...prevColumns];
            const fromColumn = newColumns.find(col => col.id === fromColumnId);
            const toColumn = newColumns.find(col => col.id === toColumnId);
            
            if (!fromColumn || !toColumn) return prevColumns;

            const application = fromColumn.applications.find(app => app.id === applicationId);
            if (!application) return prevColumns;

            // Remove from source column
            fromColumn.applications = fromColumn.applications.filter(app => app.id !== applicationId);
            
            // Add to target column
            toColumn.applications.push(application);

            // If moving to Placement, trigger placement actions
            if (toColumnId === 'placement') {
                // These actions would be triggered:
                // 1. Force note to be entered
                // 2. Automatically add note to Candidate record and Job order
                // 3. Force task to be scheduled
                // 4. Send email to Account Manager and recruiter
                console.log('Application moved to Placement - triggering placement actions');
            }

            return newColumns;
        });
    };

    return (
        <div className="flex flex-col h-screen relative bg-gray-100">
            {/* X button in top right corner */}
            <button
                onClick={handleClose}
                className="absolute top-2 right-2 z-10 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close and return to home"
            >
                <FiX size={24} />
            </button>

            {/* Main Kanban Board */}
            <div className="flex-grow overflow-x-auto overflow-y-hidden p-4">
                <div className="flex gap-4 h-full min-w-max">
                    {columns.map((column) => (
                        <div
                            key={column.id}
                            className="flex-shrink-0 w-64 flex flex-col"
                        >
                            {/* Column Header */}
                            <div className="bg-white rounded-t-lg p-3 border-b-2 border-gray-300">
                                <h2 className="text-lg font-semibold text-gray-800 text-center">
                                    {column.title}
                                </h2>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 bg-gray-50 rounded-b-lg p-3 overflow-y-auto space-y-3">
                                {column.applications.map((application) => (
                                    <div
                                        key={application.id}
                                        onClick={() => handleTileClick(application)}
                                        className={`${column.color} rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all transform hover:scale-105`}
                                    >
                                        <div className="text-gray-800 font-medium mb-1">
                                            {application.companyName}
                                        </div>
                                        <div className="text-gray-700 text-sm mb-1">
                                            {application.jobId}
                                        </div>
                                        <div className="text-gray-800 text-sm font-semibold mb-2">
                                            {application.jobName}
                                        </div>
                                        <div className="flex items-center justify-end text-gray-700">
                                            <HiEye className="mr-1" size={16} />
                                            <span className="text-sm font-medium">#{application.viewCount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation buttons at bottom */}
            <div className="flex justify-between items-center p-4 border-t border-gray-300 bg-white">
                {/* Left side - Previous button */}
                <div className="flex items-center space-x-4">
                    <div className="text-right">
                        <div className="text-lg mb-1 text-gray-700">Previous</div>
                        <button
                            onClick={handlePrevious}
                            className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded flex items-center justify-center transition-colors"
                        >
                            <FiChevronLeft size={20} />
                        </button>
                    </div>
                </div>

                {/* Right side - Save and navigation arrows */}
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-10 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Saving...' : 'SAVE'}
                    </button>
                    <div className="flex items-center space-x-2">
                        <button
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                            aria-label="Previous page"
                        >
                            <FiChevronLeft size={20} />
                        </button>
                        <button
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                            aria-label="Next page"
                        >
                            <FiChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
