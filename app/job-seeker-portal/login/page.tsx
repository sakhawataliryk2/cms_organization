"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setCookie } from "cookies-next";

export default function JobSeekerPortalLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState(""); // email
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/job-seeker-portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: username.trim(),
          password,
          remember,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setError(data?.message || "Invalid username or password");
        return;
      }

      const token = data?.token;
      if (!token) {
        setError("No token received from server");
        return;
      }

      // ✅ Save token in cookie so Next API routes can read it later
      setCookie("jobseeker_token", token, {
        maxAge: remember ? 60 * 60 * 24 * 7 : 60 * 60 * 6, // 7 days vs 6 hours
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      // Optional: store basic portal user info
      setCookie(
        "jobseeker_user",
        JSON.stringify({
          id: data?.user?.id || data?.user?.job_seeker_id,
          name: data?.user?.name || "",
          email: data?.user?.email || username.trim(),
        }),
        {
          maxAge: remember ? 60 * 60 * 24 * 7 : 60 * 60 * 6,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
        }
      );

      router.push("/job-seeker-portal/documents");
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
  <div className="w-full max-w-[920px]">
    {/* Logo */}
    

    {/* Login Card */}
    <div className="mx-auto w-full max-w-[640px] bg-white border border-gray-300 rounded-lg shadow-xl px-10 py-8">
      <div className="flex justify-center mb-8">
      <img
        src="https://completestaffingsolutions.com/wp-content/themes/completestaffing/images/logo.svg"
        alt="Complete Staffing Solutions"
        className="h-20 object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
          <label className="text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 px-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
            autoComplete="username"
          />

          <label className="text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="h-10 px-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <input
            id="remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label htmlFor="remember" className="text-sm text-gray-600">
            Remember me on this computer
          </label>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-blue-700 underline"
            onClick={() =>
              router.push("/job-seeker-portal/auth/forgot-password")
            }
          >
            Forgot Password?
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className="h-12 px-16 rounded bg-[#4b4b4b] text-white font-semibold tracking-wide shadow-md hover:bg-[#3f3f3f] disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in »"}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

  );
}
