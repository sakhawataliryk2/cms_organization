// app/dashboard/admin/field-management/page.tsx

'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiChevronRight } from 'react-icons/fi';

interface Section {
    id: string;
    name: string;
}

export default function FieldManagement() {
    const router = useRouter();
    const [sections] = useState<Section[]>([
        { id: 'organizations', name: 'Organizations' },
        { id: 'jobs', name: 'Jobs' },
        { id: 'jobs-direct-hire', name: 'Jobs Direct Hire' },
        { id: 'jobs-executive-search', name: 'Jobs Executive Search'},
        { id: 'job-seekers', name: 'Job Seekers' },
        { id: 'leads', name: 'Leads' },
        { id: 'hiring-managers', name: 'Hiring Managers' },
        { id: 'planner', name: 'Planner' },
        { id: 'tasks', name: 'Tasks' },
        { id: 'placements', name: 'Placements' },
        { id: 'goals-quotas', name: 'Goals and Quotas' },
        { id: 'tearsheets', name: 'Tearsheets' },
    ]);

    const handleSectionClick = (sectionId: string) => {
        router.push(`/dashboard/admin/field-mapping?section=${sectionId}`);
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
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