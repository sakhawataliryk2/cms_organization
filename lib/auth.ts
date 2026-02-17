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

export const logout = (redirectUrl?: string) => {
    deleteCookie('token');
    deleteCookie('user');

    if (typeof window !== 'undefined') {
        const loginUrl = redirectUrl 
            ? `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`
            : '/auth/login';
        window.location.href = loginUrl;
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
            // Token is invalid, redirect to login with current URL preserved
            const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;
            logout(currentUrl);
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
    }
};

// Custom hook for authentication protection
export function useAuth() {
    const router = useRouter();
    const pathname = usePathname() ?? "";

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isLoggedIn = isAuthenticated();

        if (!isLoggedIn) {
            const currentPath = window.location.pathname;
            const currentSearch = window.location.search;

            // Avoid redirect loop
            if (
                currentPath !== '/auth/login' &&
                currentPath !== '/auth/signup' &&
                !currentPath.startsWith('/job-seeker-portal')
            ) {
                // Store current URL in sessionStorage as backup (survives cookie clearing)
                const fullUrl = currentPath + currentSearch;
                try {
                    sessionStorage.setItem('auth_redirect', fullUrl);
                } catch (e) {
                    // Ignore sessionStorage errors (private browsing, etc.)
                }
                
                // Preserve the original URL when redirecting to login
                const loginUrl = fullUrl
                    ? `/auth/login?redirect=${encodeURIComponent(fullUrl)}`
                    : '/auth/login';
                window.location.href = loginUrl;
            }
        } else {
            // Clear stored redirect when authenticated
            try {
                sessionStorage.removeItem('auth_redirect');
            } catch (e) {
                // Ignore sessionStorage errors
            }
            refreshTokenIfNeeded();
        }
    }, [pathname]);

    return {
        user: getUser(),
        isAuthenticated: isAuthenticated(),
    };
}
