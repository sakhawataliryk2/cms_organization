'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { SiMonster, SiGoogle } from "react-icons/si";
import { PiOfficeChairDuotone } from "react-icons/pi";
import { FiX, FiArrowLeft, FiExternalLink } from "react-icons/fi";

const STORAGE_KEY = 'sourcing_active_module';

interface SourcingModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    url: string;
    embeddable: boolean;
}

const sourcingModules: SourcingModule[] = [
    {
        id: 'google',
        name: 'Google',
        icon: <SiGoogle size={50} color="white" />,
        url: 'https://www.google.com/search?igu=1',
        embeddable: true,
    },
    {
        id: 'monster',
        name: 'Monster',
        icon: <SiMonster size={50} color="white" />,
        url: 'https://hiring.monster.com/',
        embeddable: false,
    },
    {
        id: 'ziprecruiter',
        name: 'ZipRecruiter',
        icon: <PiOfficeChairDuotone size={50} color="white" />,
        url: 'https://www.ziprecruiter.com/authn/employer/login?next_url=%2Femp%2F',
        embeddable: false,
    },
];

function openPlatform(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function iframeSrc(module: SourcingModule) {
    if (module.embeddable) return module.url;
    return `/dashboard/sourcing/bridge?url=${encodeURIComponent(module.url)}`;
}

export default function SourcingPage() {
    const router = useRouter();
    const [activeModule, setActiveModule] = useState<string | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && sourcingModules.some(m => m.id === saved)) {
            setActiveModule(saved);
        }
    }, []);

    const handleModuleClick = (id: string) => {
        setActiveModule(id);
        localStorage.setItem(STORAGE_KEY, id);
    };

    const handleBack = () => {
        setActiveModule(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    const handleGoBack = () => {
        localStorage.removeItem(STORAGE_KEY);
        router.push('/dashboard');
    };

    const active = sourcingModules.find(m => m.id === activeModule);

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className={`mx-auto ${activeModule ? 'max-w-[1400px]' : 'max-w-5xl'}`}>
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

                {!activeModule ? (
                    <>
                        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                            <p className="text-gray-600 mb-4">
                                Select a platform to source candidates. Google embeds directly. Monster and ZipRecruiter are loaded through a demo proxy so we can show what an in-window browser would actually look like.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {sourcingModules.map((module) => (
                                <div
                                    key={module.id}
                                    className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => handleModuleClick(module.id)}
                                >
                                    <div className="w-28 h-28 bg-black flex items-center justify-center mb-3 rounded-sm">
                                        {module.icon}
                                    </div>
                                    <span className="text-base text-center text-black leading-tight">
                                        {module.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-100 transition duration-150 ease-in-out"
                            >
                                <FiArrowLeft size={18} />
                                <span className="font-medium text-gray-700">Back to Sourcing</span>
                            </button>
                            <p className="text-gray-600">
                                <span className="font-semibold">{active?.name}</span> — Use the platform below to search and source candidates.
                            </p>
                            {active?.url && (
                                <button
                                    type="button"
                                    onClick={() => openPlatform(active.url)}
                                    className="ml-auto inline-flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                                >
                                    <FiExternalLink size={16} />
                                    Open in new tab
                                </button>
                            )}
                        </div>


                        {/* {active && !active.embeddable && (
                            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
                                Demo proxy: our server fetches {active.name} and shows it here.
                                If login or search breaks, that is the point to show the client — this is not a real in-window browser.
                            </p>
                        )} */}

                        {active && (
                            <iframe
                                src={iframeSrc(active)}
                                className="w-full bg-white rounded-lg shadow-md border-0"
                                style={{ height: 'calc(100vh - 220px)' }}
                                title={active.name}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
