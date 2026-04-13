'use client';

import { useState, FormEvent, Suspense } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";

function ChangePasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstLogin = searchParams?.get("firstLogin") === "1" ? true : false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validatePassword = (p: string): string | null => {
    if (!p || p.length < 8) return "Password must be at least 8 characters long";
    if (!/[a-z]/.test(p)) return "Password must contain at least one lowercase letter";
    if (!/[A-Z]/.test(p)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(p)) return "Password must contain at least one number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(p))
      return "Password must contain at least one special character";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to change password");
      }
      setSuccess("Password updated successfully. Redirecting to home...");
      setTimeout(() => {
        router.push("/home");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-xl font-semibold mb-2 text-gray-800">
          {firstLogin ? "Set a new password" : "Change password"}
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          {firstLogin
            ? "For security, you must change your temporary password before continuing."
            : "Update your account password."}
        </p>

        {error && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-2.5 text-xs text-gray-500"
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-2.5 text-xs text-gray-500"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-2.5 text-xs text-gray-500"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChangePasswordInner />
    </Suspense>
  );
}
