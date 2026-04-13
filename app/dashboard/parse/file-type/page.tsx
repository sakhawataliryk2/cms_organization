'use client'

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import LoadingScreen from '@/components/LoadingScreen';

export default function FileTypeSelection() {
    const [isProcessing, setIsProcessing] = useState(false);
    const router = useRouter();

    const fileTypes = [
        { id: 'organizations', name: 'Organizations', icon: '/window.svg', color: 'bg-slate-300' },
        { id: 'hiring-managers', name: 'Hiring Managers', icon: '/globe.svg', color: 'bg-purple-300' },
        { id: 'job-seekers', name: 'Job Seekers', icon: '/file.svg', color: 'bg-orange-300' },
        { id: 'jobs', name: 'JOBS', icon: '/window.svg', color: 'bg-green-300' },
    ];

    const handleTypeSelect = (typeId: string) => {
        setIsProcessing(true);

        // Handle specific redirection for each type
        if (typeId === 'organizations') {
            router.push('/dashboard/organizations/add');
        } else if (typeId === 'hiring-managers') {
            router.push('/dashboard/hiring-managers/add');
        } else if (typeId === 'job-seekers') {
            router.push(`/dashboard/job-seekers/add`);
        } else if (typeId === 'jobs') {
            router.push(`/dashboard/jobs/add`);
        }
    };

    if (isProcessing) {
        return <LoadingScreen message="Processing your file..." />;
    }

    return (
        <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center">Which File Type is this?</h1>

                <div className="flex flex-col">
                    {/* File type selection - Responsive grid layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {fileTypes.map((type) => (
                            <div
                                key={type.id}
                                className="cursor-pointer transition-all duration-200 hover:transform hover:scale-105"
                                onClick={() => handleTypeSelect(type.id)}
                            >
                                <div className={`${type.color} p-4 rounded flex items-center h-16 relative`}>
                                    <div className="absolute left-2">
                                        <Image src={type.icon} alt={type.name} width={24} height={24} />
                                    </div>
                                    <span className="font-medium mx-auto pl-6">{type.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}