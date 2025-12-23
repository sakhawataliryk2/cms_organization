'use client'

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import LoadingScreen from '@/components/LoadingScreen';
import DashboardNav from '@/components/DashboardNav';

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const [isLoading, setIsLoading] = useState(true);
    const { user, isAuthenticated } = useAuth();

    useEffect(() => {
        // If authentication status is known, stop loading
        if (user || !isAuthenticated) {
            setIsLoading(false);
        }
    }, [user, isAuthenticated]);

    if (isLoading) {
        return <LoadingScreen message="Loading dashboard..." />;
    }

    // The useAuth hook handles redirection if not authenticated
    // This check is redundant but added for type safety
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* DashboardNav includes the side nav and top bar */}
            <DashboardNav />

            {/* Main content */}
            <div
                className="ml-60 p-6"
                style={{ paddingTop: "var(--dashboard-top-offset, 48px)" }}
            >
                {children}
            </div>
        </div>
    );
}