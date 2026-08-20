'use client'

import { useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { SiMonster } from "react-icons/si";
import { PiOfficeChairDuotone } from "react-icons/pi";
import { FiX } from "react-icons/fi";

interface SourcingModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    path: string;
}

export default function SourcingPage() {
    const router = useRouter();

    const sourcingModules: SourcingModule[] = [
        {
            id: 'monster',
            name: 'Monster',
            icon: <SiMonster size={50} color="white" />,
            path: '/dashboard/sourcing/monster'
        },
        {
            id: 'ziprecruiter',
            name: 'ZipRecruiter',
            icon: <PiOfficeChairDuotone size={50} color="white" />,
            path: '/dashboard/sourcing/ziprecruiter'
        }
    ];

    const handleModuleClick = (path: string) => {
        router.push(path);
    };

    const handleGoBack = () => {
        router.push('/dashboard');
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Sourcing</h1>
                    <button
                        onClick={handleGoBack}
                        className="p-2 hover:bg-gray-300 rounded-full transition duration-150 ease-in-out"
                        aria-label="Close"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <p className="text-gray-600 mb-4">
                        Select a job board to source candidates. You can search and import talent from the platforms below.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {sourcingModules.map((module) => (
                        <div
                            key={module.id}
                            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleModuleClick(module.path)}
                        >
                            {/* Module Icon - Black square with white icon */}
                            <div className="w-28 h-28 bg-black flex items-center justify-center mb-3 rounded-sm">
                                {module.icon}
                            </div>

                            {/* Module Name */}
                            <span className="text-base text-center text-black leading-tight">
                                {module.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
