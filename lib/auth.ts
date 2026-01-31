import { getCookie, setCookie, deleteCookie } from 'cookies-next';
import { jwtVerify } from 'jose';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface UserData {
    id: string;
    name: string;
    email: string;
    userType: string;
}

export const getUser = (): UserData | null => {
    try {
        const userData = getCookie('user');
        if (!userData) return null;

        return JSON.parse(userData as string);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
};

export const isAuthenticated = (): boolean => {
    const token = getCookie('token');
    return !!token;
};

export const logout = () => {
    deleteCookie('token');
    deleteCookie('user');

    if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
    }
};

export const verifyToken = async (token: string): Promise<boolean> => {
    try {
        const secretKey = new TextEncoder().encode(
            process.env.JWT_SECRET || 'your-secret-key'
        );

        await jwtVerify(token, secretKey);
        return true;
    } catch (error) {
        console.error('Token verification failed:', error);
        return false;
    }
};

export const getUserRole = (): string | null => {
    const user = getUser();
    return user ? user.userType : null;
};

// Function to refresh the token if needed
export const refreshTokenIfNeeded = async (): Promise<void> => {
    try {
        const token = getCookie('token') as string;
        if (!token) return;

        // Check if the token is about to expire
        let response;
        try {
            response = await fetch('/api/check-token', {
                method: 'GET',
                credentials: 'include',
            });
        } catch (fetchError) {
            // Silently handle fetch errors (network issues, etc.)
            return;
        }
        
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
            // If not JSON or not OK, likely an error page - skip token refresh silently
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            // If JSON parsing fails, silently return
            return;
        }

        if (!data.success) {
            // Token is invalid, redirect to login
            logout();
            return;
        }

        // Token is valid, check expiration time
        const expiresAt = new Date(data.exp).getTime();
        const now = new Date().getTime();
        const timeUntilExpiry = expiresAt - now;

        // If token expires in less than 5 minutes (300000 ms), refresh it
        if (timeUntilExpiry < 300000) {
            try {
                const refreshResponse = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token }),
                });

                if (refreshResponse.ok) {
                    const refreshContentType = refreshResponse.headers.get('content-type');
                    if (refreshContentType && refreshContentType.includes('application/json')) {
                        try {
                            const refreshData = await refreshResponse.json();
                            // Update token cookie
                            setCookie('token', refreshData.token, {
                                maxAge: 60 * 60 * 24 * 7, // 7 days
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'strict',
                                path: '/'
                            });
                        } catch (parseError) {
                            // Silently ignore JSON parse errors
                        }
                    }
                }
            } catch (refreshError) {
                // Silently handle refresh errors
            }
        }
    } catch (error) {
        // Silently handle all errors to avoid console spam
        // Errors are already handled by try-catch blocks around JSON parsing
        // No need to log anything here
    }
};

// Custom hook for authentication protection
export function useAuth() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check authentication status on every pathname change (client-side navigation)
        // This handles the case when cookies are cleared while on a cached page
        if (typeof window !== 'undefined') {
            const isLoggedIn = isAuthenticated();

            if (!isLoggedIn) {
                // Store current path for redirect after login if needed
                const currentPath = window.location.pathname;
                if (currentPath !== '/auth/login' && currentPath !== '/auth/signup' && !currentPath.startsWith('/job-seeker-portal')) {
                    const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
                    // Use window.location for full reload - ensures middleware runs and clears any cached state
                    window.location.href = `/auth/login?redirect=${redirectUrl}`;
                } else if (!currentPath.startsWith('/job-seeker-portal')) {
                    window.location.href = '/auth/login';
                }
            } else {
                // If logged in, refresh token if needed
                refreshTokenIfNeeded();
            }
        }
    }, [pathname, router]);

    // Return user data for convenience
    return { user: getUser(), isAuthenticated: isAuthenticated() };
}