"use client";

import { FormEvent, useState, KeyboardEvent, ClipboardEvent, useRef } from "react";
import Image from "next/image";
import { useRouter } from "nextjs-toploader/app";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const router = useRouter();

  const handleRequestCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
        }/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message || "Failed to request password reset. Please try again."
        );
      }

      setMessage(
        data.message ||
          "If an account exists for this email, a reset code has been sent."
      );
      setStep(2);
      setOtpValues(Array(6).fill(""));
      setResetError("");
    } catch (err: any) {
      setError(
        err.message || "Failed to request password reset. Please try again."
      );
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
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      const next = [...otpValues];
      next[index - 1] = "";
      setOtpValues(next);
      otpInputsRef.current[index - 1]?.focus();
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
    otpInputsRef.current[digits.length - 1]?.focus();
    e.preventDefault();
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError("");

    const code = otpValues.join("");
    if (code.length !== otpValues.length) {
      setResetError("Please enter the full 6-digit code.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setResetError("Please enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
        }/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            otp: code,
            newPassword,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to reset password.");
      }

      router.push("/auth/login?reset=success");
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-10">
            <Image
              src="https://completestaffingsolutions.com/wp-content/themes/completestaffing/images/logo.svg"
              alt="Complete Staffing Solutions Logo"
              width={220}
              height={90}
              priority
            />
          </div>

          {step === 1 && (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Forgot your password?
              </h1>
              <p className="text-sm text-gray-600 mb-4">
                Enter your email address and we&apos;ll send you a 6-digit code
                to reset your password.
              </p>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                  {error}
                </div>
              )}
              {message && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-4 text-sm">
                  {message}
                </div>
              )}

              <form onSubmit={handleRequestCode} className="space-y-4">
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

                <button
                  type="submit"
                  className="w-full py-3 mt-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex justify-center items-center"
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
                      Sending code...
                    </>
                  ) : (
                    "Send reset code"
                  )}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Reset your password
              </h1>
              <p className="text-sm text-gray-600 mb-4">
                Enter the 6-digit code we sent to{" "}
                <span className="font-medium">{email}</span> and choose a new
                password.
              </p>

              {resetError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                  {resetError}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
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

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    New password
                  </label>
                  <input
                    type="password"
                    className="w-full py-2.5 px-3 border-b border-gray-300 focus:outline-none focus:border-blue-500 dark:text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    className="w-full py-2.5 px-3 border-b border-gray-300 focus:outline-none focus:border-blue-500 dark:text-white"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 mt-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex justify-center items-center disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {resetLoading ? (
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
                      Resetting password...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

