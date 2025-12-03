'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ManagementModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    path: string;
}

export default function UserManagement() {
    const router = useRouter();

    const managementModules = [
        {
            id: 'add-office',
            name: 'Add Office',
            icon: (
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="120" height="120" fill="white" />
                    <path d="M57 20H82C84.2091 20 86 21.7909 86 24V96H53V24C53 21.7909 54.7909 20 57 20Z" stroke="black" strokeWidth="3" />
                    <rect x="58" y="32" width="7" height="7" fill="black" />
                    <rect x="58" y="46" width="7" height="7" fill="black" />
                    <rect x="58" y="60" width="7" height="7" fill="black" />
                    <rect x="58" y="74" width="7" height="7" fill="black" />
                    <rect x="74" y="32" width="7" height="7" fill="black" />
                    <rect x="74" y="46" width="7" height="7" fill="black" />
                    <rect x="74" y="60" width="7" height="7" fill="black" />
                    <rect x="74" y="74" width="7" height="7" fill="black" />
                    <path d="M53 96V55H38V96H53Z" stroke="black" strokeWidth="3" />
                    <rect x="42" y="60" width="7" height="7" fill="black" />
                    <rect x="42" y="74" width="7" height="7" fill="black" />
                    <path d="M38 55V39C38 37.3431 39.3431 36 41 36H50C51.6569 36 53 37.3431 53 39V55H38Z" stroke="black" strokeWidth="3" />
                    <rect x="92" y="50" width="25" height="25" rx="12.5" fill="black" />
                    <path d="M104.5 57.5V67.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    <path d="M109.5 62.5L99.5 62.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
            ),
            path: '/dashboard/admin/user-management/add-office'
        },
       
        
        {
            id: 'add-team',
            name: 'Add Team',
            icon: (
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="120" height="120" fill="white" />
                    <path d="M43 39C43 45.0751 38.0751 50 32 50C25.9249 50 21 45.0751 21 39C21 32.9249 25.9249 28 32 28C38.0751 28 43 32.9249 43 39Z" stroke="black" strokeWidth="2" />
                    <path d="M32 50V50C23.7157 50 17 56.7157 17 65V65" stroke="black" strokeWidth="2" />
                    <path d="M74 32C74 38.0751 69.0751 43 63 43C56.9249 43 52 38.0751 52 32C52 25.9249 56.9249 21 63 21C69.0751 21 74 25.9249 74 32Z" stroke="black" strokeWidth="2" />
                    <path d="M63 43V43C54.7157 43 48 49.7157 48 58V58" stroke="black" strokeWidth="2" />
                    <path d="M95 45C95 51.0751 90.0751 56 84 56C77.9249 56 73 51.0751 73 45C73 38.9249 77.9249 34 84 34C90.0751 34 95 38.9249 95 45Z" stroke="black" strokeWidth="2" />
                    <path d="M84 56V56C75.7157 56 69 62.7157 69 71V71" stroke="black" strokeWidth="2" />
                    <circle cx="92" cy="75" r="12.5" fill="black" />
                    <path d="M92 67.5V82.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    <path d="M99.5 75L84.5 75" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
            ),
            path: '/dashboard/admin/user-management/add-team'
        },
        {
            id: 'add-user',
            name: 'Add User',
            icon: (
                <svg width="76" height="76" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="76" height="76" fill="white" />
                    <path d="M47 36C47 43.1797 41.1797 49 34 49C26.8203 49 21 43.1797 21 36C21 28.8203 26.8203 23 34 23C41.1797 23 47 28.8203 47 36Z" stroke="black" strokeWidth="2" />
                    <path d="M34 49V49C24.6112 49 17 56.6112 17 66V66" stroke="black" strokeWidth="2" />
                    <path d="M48 47L48 57" stroke="black" strokeWidth="2" />
                    <path d="M53 52L43 52" stroke="black" strokeWidth="2" />
                </svg>
            ),
            path: '/dashboard/admin/user-management/add-user'
        },
    ];

    const handleModuleClick = (path: string) => {
        router.push(path);
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin');
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                    <button
                        onClick={handleGoBack}
                        className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition duration-150 ease-in-out"
                    >
                        Back
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {managementModules.map((module) => (
                        <div
                            key={module.id}
                            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleModuleClick(module.path)}
                        >
                            {/* Module Icon - Black square with white icon */}
                            <div className="w-28 h-28 bg-white flex items-center justify-center mb-3 border border-gray-300">
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