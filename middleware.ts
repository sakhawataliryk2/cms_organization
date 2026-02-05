import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Skip middleware for job seeker portal
  if (path.startsWith("/job-seeker-portal")) {
    return NextResponse.next();
  }

  // Skip middleware for ALL API routes - they handle their own authentication
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Define public paths that don't require authentication
  const isPublicPath =
    path === "/auth/login" ||
    path === "/auth/signup" ||
    path === "/" ||
    path.startsWith("/_next") ||
    path.startsWith("/images") ||
    path.startsWith("/public") ||
    path === "/favicon.ico";

  // Get the token from cookies
  const token = request.cookies.get("token")?.value;

  // Helper function to check if URL is from the same site
  const isSameSite = (url: string, baseUrl: URL): boolean => {
    try {
      // If it's a relative path (starts with /), it's same site
      if (url.startsWith("/")) return true;
      
      // If it's a full URL, check the origin
      const urlObj = new URL(url, baseUrl);
      return urlObj.origin === baseUrl.origin;
    } catch (e) {
      // If URL parsing fails, assume it's not same site
      return false;
    }
  };

  // Helper function to check if URL is an action page (approve/deny) that should be preserved
  const isActionPage = (url: string): boolean => {
    return (url.includes('/transfer/') && (url.includes('/approve') || url.includes('/deny'))) ||
           (url.includes('/delete/') && (url.includes('/approve') || url.includes('/deny')));
  };

  // If the path is public and user is logged in, check for redirect param
  // This prevents logged-in users from accessing login/signup pages
  if (isPublicPath && token) {
    // If there's a redirect param, check if it's same site or external
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    if (redirectParam && path === "/auth/login") {
      const redirectUrl = decodeURIComponent(redirectParam);
      
      if (isSameSite(redirectUrl, request.nextUrl)) {
        // Same site: check if it's an action page (approve/deny)
        if (isActionPage(redirectUrl)) {
          // Action pages: redirect back to the page itself
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        } else {
          // Other same-site pages: redirect to home page
          return NextResponse.redirect(new URL("/home", request.url));
        }
      } else {
        // External site: redirect to that URL
        try {
          const externalUrl = new URL(redirectUrl);
          return NextResponse.redirect(externalUrl);
        } catch (e) {
          // Invalid URL, go to dashboard
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the path requires authentication and user is not logged in, redirect to login with original URL
  if (!isPublicPath && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    // Preserve the original URL as a redirect parameter
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }


  // For protected routes, verify the token
  if (!isPublicPath && token) {
    try {
      // Verify token
      const secretKey = new TextEncoder().encode(
        process.env.JWT_SECRET || "your-secret-key"
      );

      // More verbose error handling for debugging
      try {
        await jwtVerify(token, secretKey);
        // Token is valid, continue to the requested page
        return NextResponse.next();
      } catch (jwtError: any) {
        // Only log and redirect if it's a real error, not just token expiration warnings
        if (jwtError.code !== "ERR_JWT_EXPIRED" && jwtError.name !== "JWTExpired") {
          console.error("JWT verification error in middleware:", jwtError.name, jwtError.message);
        }

        // Prevent redirect loop - if we're already going to login, just clear cookies and continue
        if (path === "/auth/login") {
          const response = NextResponse.next();
          response.cookies.delete("token");
          response.cookies.delete("user");
          return response;
        }

        // Clear invalid cookies and redirect to login with original URL
        const loginUrl = new URL("/auth/login", request.url);
        // Preserve the original URL as a redirect parameter
        loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("token");
        response.cookies.delete("user");

        return response;
      }
    } catch (error: any) {
      // Token is invalid, redirect to login with original URL
      console.error("Invalid token or other error:", error?.name || error?.message || error);

      // Prevent redirect loop - if we're already going to login, just clear cookies and continue
      if (path === "/auth/login") {
        const response = NextResponse.next();
        response.cookies.delete("token");
        response.cookies.delete("user");
        return response;
      }

      // Clear invalid cookies
      const loginUrl = new URL("/auth/login", request.url);
      // Preserve the original URL as a redirect parameter
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("token");
      response.cookies.delete("user");

      return response;
    }
  }

  // Continue for public paths or if token verification was successful
  return NextResponse.next();
}

// Configure which paths should trigger this middleware
export const config = {
  matcher: [
    // Match all paths except for static files, api routes, images, etc.
    "/((?!_next/static|_next/image|favicon.ico|images|public|api).*)",
  ],
};
