'use client'

import { useRouter } from 'nextjs-toploader/app';
import { SiMonster, SiGoogle } from "react-icons/si";
import { PiOfficeChairDuotone } from "react-icons/pi";
import { FiX } from "react-icons/fi";

interface SourcingModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    url: string;
}

const sourcingModules: SourcingModule[] = [
    {
        id: 'google',
        name: 'Google',
        icon: <SiGoogle size={50} color="white" />,
        url: 'https://www.google.com/',
    },
    {
        id: 'monster',
        name: 'Monster',
        icon: <SiMonster size={50} color="white" />,
        url: 'https://hiring.monster.com/',
    },
    {
        id: 'ziprecruiter',
        name: 'ZipRecruiter',
        icon: <PiOfficeChairDuotone size={50} color="white" />,
        url: 'https://www.ziprecruiter.com/authn/employer/login?next_url=%2Femp%2F',
    },
];

export default function SourcingPage() {
    const router = useRouter();

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Sourcing</h1>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="p-2 hover:bg-gray-300 rounded-full transition duration-150 ease-in-out"
                        aria-label="Close"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <p className="text-gray-600 mb-4">
                        Select a job board to source candidates. Each platform opens in a new tab.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {sourcingModules.map((module) => (
                        <a
                            key={module.id}
                            href={module.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center hover:opacity-80 transition-opacity"
                        >
                            <div className="w-28 h-28 bg-black flex items-center justify-center mb-3 rounded-sm">
                                {module.icon}
                            </div>
                            <span className="text-base text-center text-black leading-tight">
                                {module.name}
                            </span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
