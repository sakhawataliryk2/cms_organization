'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { SiMonster } from "react-icons/si";
import { PiOfficeChairDuotone } from "react-icons/pi";
import { FiX, FiArrowLeft } from "react-icons/fi";

const STORAGE_KEY = 'sourcing_active_module';

interface SourcingModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    url: string;
}

const sourcingModules: SourcingModule[] = [
    {
        id: 'monster',
        name: 'Monster',
        icon: <SiMonster size={50} color="white" />,
        url: 'https://hiring-identity.monster.com/login?state=hKFo2SBjV0U3ZkRFNUxmLWkzMVZabHVEekRCODRQXzRuRmVkLaFupWxvZ2luo3RpZNkgQmFWdWlyejYwWW1yal9VTHdNUVdGWDR1b2pIaUdzd2ijY2lk2SAybmszc2JORnlaR0VmczZvRjlYcGF1SUx4VUEyRmhKNg&client=2nk3sbNFyZGEfs6oF9XpauILxUA2FhJ6&protocol=oauth2&callbackURL=https%3A%2F%2Fmanage.monster.com%2Fauth%2Fcallback&scope=openid%20email%20profile%20offline_access&keepSessionInfo=true&loginAction=&apigeeApiKey=4u8nirp5l6ugasm1im1itrg0er&deviceId=f1f7c950-2c2c-4318-aef7-442e58a155e3&employerEnvironment=prod-ams&employerLocale=en-US&employerHost=https%3A%2F%2Fmanage.monster.com&employerBffDomain=https%3A%2F%2Fappsapi.monster.io%2Femployer-bff%2Fv1&clientId=1171520291.1787231904&sessionId=1787231949&productRatePlanId=&audience=employer-bff-api-gateway&nonce=afc133bf7b7c296f1b72f921b40da9ba&response_type=code&redirect_uri=https%3A%2F%2Fmanage.monster.com%2Fauth%2Fcallback'
    },
    {
        id: 'ziprecruiter',
        name: 'ZipRecruiter',
        icon: <PiOfficeChairDuotone size={50} color="white" />,
        url: 'https://www.ziprecruiter.com/authn/employer/login?next_url=%2Femp%2F'
    }
];

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

                {!activeModule ? (
                    <>
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
                        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleBack}
                                    className="p-2 hover:bg-gray-200 rounded-full transition duration-150 ease-in-out"
                                >
                                    <FiArrowLeft size={20} />
                                </button>
                                <p className="text-gray-600">
                                    <span className="font-semibold">{active?.name}</span> — Use the platform below to search and source candidates.
                                </p>
                            </div>
                        </div>

                        <iframe
                            src={active?.url}
                            className="w-full bg-white rounded-lg shadow-md border-0"
                            style={{ height: 'calc(100vh - 260px)' }}
                            title={active?.name}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
