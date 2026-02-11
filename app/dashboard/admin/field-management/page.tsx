// app/dashboard/admin/field-management/page.tsx

'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiChevronRight, FiX } from 'react-icons/fi';

interface Section {
    id: string;
    name: string;
}

export default function FieldManagement() {
    const router = useRouter();
    const [sections] = useState<Section[]>([
        { id: 'organizations', name: 'Organizations' },
        { id: 'jobs', name: 'Jobs Contract' },
        { id: 'jobs-direct-hire', name: 'Jobs Direct Hire' },
        { id: 'jobs-executive-search', name: 'Jobs Executive Search'},
        { id: 'job-seekers', name: 'Job Seekers' },
        { id: 'leads', name: 'Leads' },
        { id: 'hiring-managers', name: 'Hiring Managers' },
        { id: 'planner', name: 'Planner' },
        { id: 'tasks', name: 'Tasks' },
        { id: 'placements', name: 'Placements Contract' },
        { id: 'placements-direct-hire', name: 'Placements Direct Hire' },
        { id: 'placements-executive-search', name: 'Placements Executive Search' },
        { id: 'goals-quotas', name: 'Goals and Quotas' },
        // { id: 'tearsheets', name: 'Tearsheets' },
    ]);

    const handleSectionClick = (sectionId: string) => {
        router.push(`/dashboard/admin/field-mapping?section=${sectionId}`);
    };

    const handleClose = () => {
        router.push('/dashboard/admin');
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8 relative">
            {/* Close Button */}
            <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close"
                title="Close"
            >
                <FiX className="w-6 h-6" />
            </button>
            <div className="max-w-2xl">
                {sections.map((section) => (
                    <div key={section.id} className="mb-1">
                        <button
                            onClick={() => handleSectionClick(section.id)}
                            className="w-full flex items-center text-black hover:bg-gray-300 p-2 rounded"
                        >
                            <span className="w-4 h-4 mr-2 flex items-center justify-center">
                                <FiChevronRight size={16} />
                            </span>
                            <span className="text-base">{section.name}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}