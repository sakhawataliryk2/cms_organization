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

  // If the path is public and user is logged in, redirect to dashboard
  // This prevents logged-in users from accessing login/signup pages
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the path requires authentication and user is not logged in, redirect to login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
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

        // Clear invalid cookies and redirect to login
        const response = NextResponse.redirect(
          new URL("/auth/login", request.url)
        );
        response.cookies.delete("token");
        response.cookies.delete("user");

        return response;
      }
    } catch (error: any) {
      // Token is invalid, redirect to login
      console.error("Invalid token or other error:", error?.name || error?.message || error);

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
    // Match all paths except for static files, api routes, images, etc.
    "/((?!_next/static|_next/image|favicon.ico|images|public|api).*)",
  ],
};
