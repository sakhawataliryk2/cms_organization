"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";

type Role = "JOB_SEEKER" | "HIRING_MANAGER";

export default function PortalLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("JOB_SEEKER");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const path =
        role === "JOB_SEEKER"
          ? "/api/portal/jobseeker/auth/login"
          : "/api/portal/hiring/auth/login";

      const res = await fetch(path, {
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

      if (role === "JOB_SEEKER") router.push("/portal/jobseeker/home");
      else router.push("/portal/hiring/home");
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[920px]">
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
              <label className="text-sm font-medium text-gray-700">Portal</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-10 px-3 border text-black border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="JOB_SEEKER">Job Seeker</option>
                <option value="HIRING_MANAGER">Hiring Manager</option>
              </select>

              <label className="text-sm font-medium text-gray-700">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 px-3 border text-black border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
                autoComplete="username"
              />

              <label className="text-sm font-medium text-gray-700">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="h-10 px-3 text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600 text-center">{error}</div>
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
                  router.push(`/portal/forgot-password?role=${role}`)
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
