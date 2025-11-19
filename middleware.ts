import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Define public paths that don't require authentication
  const isPublicPath =
    path === "/auth/login" ||
    path === "/auth/signup" ||
    path === "/" ||
    path.startsWith("/api/auth/") ||
    path === "/api/check-token";

  // Get the token from cookies
  const token = request.cookies.get("token")?.value;

  // If the path is public and user is logged in, redirect to dashboard
  // This prevents logged-in users from accessing login/signup pages
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the path requires authentication and user is not logged in, redirect to login
  if (!isPublicPath && !token) {
    // Remember the original URL to redirect back after login
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("redirect", encodeURIComponent(request.url));

    return NextResponse.redirect(url);
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
      } catch (jwtError) {
        console.error("JWT verification error in middleware:", jwtError);

        // Clear invalid cookies and redirect to login
        const response = NextResponse.redirect(
          new URL("/auth/login", request.url)
        );
        response.cookies.delete("token");
        response.cookies.delete("user");

        return response;
      }
    } catch (error) {
      // Token is invalid, redirect to login
      console.error("Invalid token or other error:", error);

      // Clear invalid cookies
      const response = NextResponse.redirect(
        new URL("/auth/login", request.url)
      );
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
    // Match all paths except for static files, api routes that don't need auth, etc.
    "/((?!_next/static|_next/image|favicon.ico|images|public).*)",
  ],
};
