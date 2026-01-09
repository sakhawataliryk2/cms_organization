"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
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
      const res = await fetch("/api/job-seeker-portal/auth/forgot-password", {
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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md border border-gray-200 rounded-lg p-6 shadow">
        <h1 className="text-lg font-semibold mb-2">Forgot Password</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter your email and we’ll send reset instructions.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full h-10 px-3 border border-gray-300 rounded"
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
            className="w-full h-10 rounded border border-gray-300"
            onClick={() => router.push("/job-seeker-portal/login")}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
