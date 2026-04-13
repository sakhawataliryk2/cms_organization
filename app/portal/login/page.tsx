"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import StyledReactSelect from "@/components/StyledReactSelect";

type Role = "JOB_SEEKER" | "HIRING_MANAGER";

export default function PortalLoginPage() {
  const [role, setRole] = useState<Role>("JOB_SEEKER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const path = role === "JOB_SEEKER" ? "/api/portal/jobseeker/auth/login" : "/api/portal/hiring/auth/login";
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res || !res.ok || !data?.success) {
      setError(data?.message || "Login failed");
      setLoading(false);
      return;
    }
    if (role === "JOB_SEEKER") router.push("/portal/jobseeker/home");
    else router.push("/portal/hiring/home");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Portal Login</h1>
        <p className="mb-4 text-sm text-slate-600">Use your Job Seeker or Hiring Manager credentials.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <StyledReactSelect
            options={[
              { label: "Job Seeker", value: "JOB_SEEKER" },
              { label: "Hiring Manager", value: "HIRING_MANAGER" },
            ]}
            value={{ label: role === "JOB_SEEKER" ? "Job Seeker" : "Hiring Manager", value: role }}
            onChange={(v) => setRole(((v as { value: Role } | null)?.value) || "JOB_SEEKER")}
            isSearchable={false}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

