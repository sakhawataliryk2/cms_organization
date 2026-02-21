"use client";
import Image from "next/image";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setCookie } from "cookies-next";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Reset error
    setError("");

    // Validate form inputs
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
        }/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      // Store user data in cookies with secure options
      if (data.token) {
        setCookie("token", data.token, {
          maxAge: 60 * 60 * 24 * 7, // 7 days
          secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
          sameSite: "strict", // CSRF protection
          path: "/", // Available across the site
        });
      } else {
        throw new Error("No authentication token received from server");
      }

      // Log the user data from the API response for debugging
      console.log("API Response User Data:", data.user);
      console.log(
        "Token received:",
        data.token ? data.token.substring(0, 20) + "..." : "No token received"
      );

      // Ensure all fields are properly captured
      const userData = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        userType:
          data.user.userType ||
          data.user.user_type ||
          data.user.role ||
          "undefined",
      };
      // Log what we're storing in the cookie
      console.log("Storing in cookie:", userData);

      setCookie("user", JSON.stringify(userData), {
        maxAge: 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      // Get redirect URL from query params, sessionStorage, or default to home page
      let redirectUrl: string | null = null;
      
      if (typeof window !== "undefined") {
        // First priority: URL query params (most reliable - from middleware)
        redirectUrl = new URLSearchParams(window.location.search).get("redirect");
        
        // Second priority: sessionStorage (fallback if cookies cleared but URL param lost)
        if (!redirectUrl) {
          try {
            redirectUrl = sessionStorage.getItem('auth_redirect');
            // Clear it after reading
            if (redirectUrl) {
              sessionStorage.removeItem('auth_redirect');
            }
          } catch (e) {
            // Ignore sessionStorage errors (private browsing, etc.)
          }
        }
      }

      // Helper function to check if URL is from the same site
      const isSameSite = (url: string): boolean => {
        if (typeof window === 'undefined') return false;
        try {
          // If it's a relative path (starts with /), it's same site
          if (url.startsWith('/')) return true;
          
          // If it's a full URL, check the origin
          const urlObj = new URL(url, window.location.origin);
          return urlObj.origin === window.location.origin;
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

      // Redirect logic: same site → home (except action pages), external site → redirect URL
      if (redirectUrl) {
        const decodedUrl = decodeURIComponent(redirectUrl);
        
        if (isSameSite(decodedUrl)) {
          // Same site: check if it's an action page (approve/deny)
          if (isActionPage(decodedUrl)) {
            // Action pages: redirect back to the page itself
            router.push(decodedUrl);
          } else {
            // Other same-site pages: redirect to home page
            router.push("/home");
          }
        } else {
          // External site: redirect to that URL
          window.location.href = decodedUrl;
        }
      } else {
        // No redirect URL: go to home page
        router.push("/home");
      }
    } catch (error: any) {
      setError(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Blue sidebar */}
      {/* <div className="w-60 bg-blue-500"></div> */}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-16">
            <Image
              src="https://completestaffingsolutions.com/wp-content/themes/completestaffing/images/logo.svg"
              alt="Complete Staffing Solutions Logo"
              width={250}
              height={100}
              priority
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Success message if redirected from registration */}
          {typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("registered") ===
              "true" && (
              <div
                className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
                role="alert"
              >
                Registration successful! Please login with your credentials.
              </div>
            )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {/* Email field */}
            <div className="relative">
              <div className="absolute left-3 top-3 text-blue-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <input
                type="email"
                placeholder="Email address"
                className="dark:text-white w-full py-3 pl-10 pr-3 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <div className="absolute left-3 top-3 text-blue-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    ry="2"
                  ></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="dark:text-white w-full py-3 pl-10 pr-10 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-3 text-gray-500 hover:text-gray-700"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              className="w-full py-3 mt-6 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex justify-center items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "LOG IN"
              )}
            </button>

            {/* Forgot password link */}
            <div className="text-center mt-2">
              <a href="#" className="text-blue-500 text-sm hover:underline">
                Forgot Password?
              </a>
            </div>

            {/* Sign up link */}
            {/* <div className="text-center mt-4">
                            <p className="text-sm text-gray-600">
                                Don't have an account?{" "}
                                <Link href="/auth/signup" className="text-blue-500 hover:underline">
                                    Sign Up
                                </Link>
                            </p>
                        </div> */}
          </form>
        </div>
      </div>
    </div>
  );
}
