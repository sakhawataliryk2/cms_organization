// File: app/dashboard/candidate-flow/page.tsx

'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiUsers, FiEye, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

interface Candidate {
    id: number;
    name: string;
    jobId: string;
}

interface CandidateColumn {
    id: string;
    title: string;
    color: string;
    candidates: Candidate[];
}

export default function CandidateFlowDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    // Sample candidate data for demonstration
    const [columns, setColumns] = useState<CandidateColumn[]>([
        {
            id: 'prescreened',
            title: 'Candidates PreScreened',
            color: 'bg-green-200',
            candidates: Array.from({ length: 5 }, (_, i) => ({
                id: i + 1,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        },
        {
            id: 'submitted',
            title: 'Candidates Submitted',
            color: 'bg-gray-400',
            candidates: Array.from({ length: 5 }, (_, i) => ({
                id: i + 101,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        },
        {
            id: 'client-submitted',
            title: 'Client Submitted',
            color: 'bg-green-300',
            candidates: Array.from({ length: 5 }, (_, i) => ({
                id: i + 201,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        },
        {
            id: 'interviews',
            title: 'Candidates with Interviews',
            color: 'bg-orange-300',
            candidates: Array.from({ length: 4 }, (_, i) => ({
                id: i + 301,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        },
        {
            id: 'offer',
            title: 'Candidates with Offer',
            color: 'bg-green-400',
            candidates: Array.from({ length: 3 }, (_, i) => ({
                id: i + 401,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        },
        {
            id: 'starting',
            title: 'Candidates Starting',
            color: 'bg-blue-200',
            candidates: Array.from({ length: 3 }, (_, i) => ({
                id: i + 501,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        },
        {
            id: 'assignment',
            title: 'Candidates on Assignment',
            color: 'bg-purple-200',
            candidates: Array.from({ length: 1 }, (_, i) => ({
                id: i + 601,
                name: 'Candidate Name',
                jobId: 'Job ID #'
            }))
        }
    ]);

    // Function to handle navigation
    const handlePrevious = () => {
        router.push('/dashboard');
    };

    const handleNext = () => {
        // Navigate to the third sales dashboard page
        router.push('/dashboard/sales-dashboard');
    };

    // Handle close/return to home
    const handleClose = () => {
        router.push('/dashboard');
    };

    // Function to render a candidate card
    const renderCandidateCard = (candidate: Candidate, color: string) => {
        return (
            <div
                key={candidate.id}
                className={`${color} rounded-xl p-4 mb-3 flex flex-col items-center transition-all`}
            >
                <div className="text-gray-700 font-medium">{candidate.name}</div>
                <div className="text-gray-800 text-sm">{candidate.jobId}</div>
                <div className="mt-1">
                    <FiEye className="text-gray-900" size={18} />
                </div>
            </div>
        );
    };

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
            
            {/* Main content area */}
            <div className="flex-grow overflow-auto">
                <div className="flex overflow-x-auto min-h-full p-2 pb-8">
                    {columns.map(column => (
                        <div key={column.id} className="flex-shrink-0 w-36 mx-2">
                            <div className="bg-white p-2 font-bold text-center border-b-2 border-gray-300">
                                {column.title}
                            </div>
                            <div className="mt-3">
                                {column.candidates.map(candidate => renderCandidateCard(candidate, column.color))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-end p-4 border-t border-gray-300 bg-white">
                <div className="flex space-x-4">
                    <div className="text-right">
                        <div className="text-lg mb-1">Previous</div>
                        <button
                            onClick={handlePrevious}
                            className="bg-teal-600 text-white w-24 h-10 rounded flex items-center justify-center"
                        >
                            <span className="transform -translate-x-1">◀</span>
                        </button>
                    </div>
                    <div className="text-right">
                        <div className="text-lg mb-1">Next</div>
                        <button
                            onClick={handleNext}
                            className="bg-teal-600 text-white w-24 h-10 rounded flex items-center justify-center"
                        >
                            <span className="transform translate-x-1">▶</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}