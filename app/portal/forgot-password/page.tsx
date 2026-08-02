"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "JOB_SEEKER" | "HIRING_MANAGER";

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = useMemo(() => {
    const r = searchParams?.get("role");
    return r === "HIRING_MANAGER" ? "HIRING_MANAGER" : "JOB_SEEKER";
  }, [searchParams]);

  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setErr("");

    try {
      const path =
        role === "JOB_SEEKER"
          ? "/api/portal/jobseeker/auth/forgot-password"
          : "/api/portal/hiring/auth/forgot-password";

      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setErr(data?.message || "Failed to send reset email");
        return;
      }

      setMsg("If this email exists, a reset message has been sent.");
    } catch {
      setErr("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md border border-gray-200 rounded-lg p-6 shadow">
      <div className="flex justify-center mb-6">
        <img
          src="https://completestaffingsolutions.com/wp-content/themes/completestaffing/images/logo.svg"
          alt="Complete Staffing Solutions"
          className="h-16 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <h1 className="text-lg font-semibold mb-2 text-black">Forgot Password</h1>
      <p className="text-sm text-gray-600 mb-4 text-black">
        Enter your email and we&apos;ll send reset instructions.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full h-10 px-3 border border-gray-300 rounded text-black bg-white"
        >
          <option value="JOB_SEEKER">Job Seeker</option>
          <option value="HIRING_MANAGER">Hiring Manager</option>
        </select>

        <input
          className="w-full h-10 px-3 border border-gray-300 rounded text-black"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {err && <div className="text-sm text-red-600">{err}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <button
          disabled={loading}
          className="w-full h-10 rounded bg-[#4b4b4b] text-white font-semibold disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Reset Email"}
        </button>

        <button
          type="button"
          className="w-full h-10 rounded border border-gray-300 text-black"
          onClick={() => router.push("/portal/login")}
        >
          Back to Login
        </button>
      </form>
    </div>
  );
}

export default function PortalForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md border border-gray-200 rounded-lg p-6 shadow text-sm text-gray-600">
            Loading...
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
