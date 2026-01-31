"use client";

import { useEffect } from "react";
import { logout } from "@/lib/auth";

/**
 * Intercepts fetch requests and redirects to login on 401 Unauthorized.
 * Handles the case when cookies are cleared but user navigates client-side -
 * API calls fail with 401, causing black screen. This ensures we redirect instead.
 */
export function AuthFetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const response = await originalFetch.call(window, input, init);

      // On 401 from our API (excluding auth routes), redirect to login
      if (response.status === 401) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url || "";
        const isAuthRoute =
          url.includes("/auth/login") ||
          url.includes("/auth/signup") ||
          url.includes("/api/auth/login") ||
          url.includes("/api/auth/signup") ||
          url.includes("/api/auth/refresh");
        if (!isAuthRoute && (url.includes("/api/") || url.startsWith("/api/"))) {
          logout();
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
