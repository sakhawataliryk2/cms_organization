"use client";
import Image from "next/image";
import {
  useState,
  FormEvent,
  useRef,
  KeyboardEvent,
  ClipboardEvent,
} from "react";
import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";
import { setCookie } from "cookies-next";
import assets from "@/app/assets/assets";


export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [otpError, setOtpError] = useState<string>("");
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const router = useRouter();

  const completeLogin = (data: any) => {
    if (!data?.token) {
      throw new Error("No authentication token received from server");
    }

    setCookie("token", data.token, {
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    const user = data.user || {};
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.userType || user.user_type || user.role || "undefined",
    };

    setCookie("user", JSON.stringify(userData), {
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    let redirectUrl: string | null = null;

    if (typeof window !== "undefined") {
      redirectUrl = new URLSearchParams(window.location.search).get(
        "redirect"
      );

      if (!redirectUrl) {
        try {
          redirectUrl = sessionStorage.getItem("auth_redirect");
          if (redirectUrl) {
            sessionStorage.removeItem("auth_redirect");
          }
        } catch {
          // Ignore sessionStorage errors
        }
      }
    }

    const isSameSite = (url: string): boolean => {
      if (typeof window === "undefined") return false;
      try {
        if (url.startsWith("/")) return true;
        const urlObj = new URL(url, window.location.origin);
        return urlObj.origin === window.location.origin;
      } catch {
        return false;
      }
    };

    const isActionPage = (url: string): boolean => {
      return (
        (url.includes("/transfer/") &&
          (url.includes("/approve") || url.includes("/deny"))) ||
        (url.includes("/delete/") &&
          (url.includes("/approve") || url.includes("/deny")))
      );
    };

    // If backend indicates a mandatory password change (first login with temp password),
    // always route to the change-password screen instead of the normal target.
    if (data?.mustChangePassword) {
      router.push("/auth/change-password?firstLogin=1");
      return;
    }

    if (redirectUrl) {
      const decodedUrl = decodeURIComponent(redirectUrl);

      if (isSameSite(decodedUrl)) {
        if (isActionPage(decodedUrl)) {
          router.push(decodedUrl);
        } else {
          router.push("/home");
        }
      } else {
        window.location.href = decodedUrl;
      }
    } else {
      router.push("/home");
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

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

      if (data.requires2FA) {
        setPendingEmail(email);
        setShowOtpModal(true);
        setOtpValues(Array(6).fill(""));
        setOtpError("");
        return;
      }

      completeLogin(data);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...otpValues];
    next[index] = cleaned;
    setOtpValues(next);

    if (cleaned && index < otpValues.length - 1) {
      const nextInput = otpInputsRef.current[index + 1];
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      const prevInput = otpInputsRef.current[index - 1];
      const next = [...otpValues];
      next[index - 1] = "";
      setOtpValues(next);
      prevInput?.focus();
      e.preventDefault();
    }
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text") || "";
    const digits = text.replace(/\D/g, "").slice(0, otpValues.length).split("");
    if (!digits.length) return;
    const next = [...otpValues];
    for (let i = 0; i < digits.length; i++) {
      next[i] = digits[i];
    }
    setOtpValues(next);
    const lastIndex = digits.length - 1;
    otpInputsRef.current[lastIndex]?.focus();
    e.preventDefault();
  };

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOtpError("");

    const code = otpValues.join("");
    if (code.length !== otpValues.length) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }

    const emailToUse = pendingEmail || email;
    if (!emailToUse) {
      setOtpError("Missing email. Please try logging in again.");
      return;
    }

    setOtpLoading(true);

    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
        }/api/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailToUse,
            otp: code,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Invalid or expired verification code."
        );
      }

      setShowOtpModal(false);
      completeLogin(data);
    } catch (err: any) {
      setOtpError(
        err.message || "OTP verification failed. Please try again."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-16">
            <Image
              src={assets.logo}
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
              <Link
                href="/auth/forgot-password"
                className="text-blue-500 text-sm hover:underline"
              >
                Forgot Password?
              </Link>
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

      {showOtpModal && (
        <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl p-6 relative">
            <button
              type="button"
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              onClick={() => {
                setShowOtpModal(false);
                setOtpValues(Array(6).fill(""));
              }}
              aria-label="Close OTP verification"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Enter verification code
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              We&apos;ve sent a 6-digit code to{" "}
              <span className="font-medium">
                {pendingEmail || email || "your email"}
              </span>
              . Enter it below to finish signing in.
            </p>

            {otpError && (
              <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex justify-between gap-2">
                {otpValues.map((value, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputsRef.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    className="h-12 w-12 rounded-md border border-gray-200 text-center text-lg font-semibold tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:bg-slate-800 dark:text-white"
                    value={value}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otpLoading}
                className="mt-4 w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 flex items-center justify-center"
              >
                {otpLoading ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
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
                    Verifying...
                  </>
                ) : (
                  "Verify and continue"
                )}
              </button>

              <p className="mt-2 text-center text-xs text-gray-500">
                Didn&apos;t receive the code? Check your spam folder or try
                again after a short while.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
