"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCookie } from "cookies-next";

export default function DenyDeletePage() {
  const params = useParams();
  const router = useRouter();
  const deleteRequestId = params?.id as string;
  const [denialReason, setDenialReason] = useState("");
  const [status, setStatus] = useState<"form" | "loading" | "success" | "error">("form");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!denialReason.trim()) {
      setMessage("Please enter a denial reason");
      return;
    }

    setStatus("loading");

    try {
      const token = getCookie("token");
      if (!token) {
        setStatus("error");
        setMessage("Authentication required. Please log in.");
        return;
      }

      const response = await fetch(`/api/placements/delete/${deleteRequestId}/deny`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          denial_reason: denialReason.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Delete request denied successfully!");
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to deny delete request");
      }
    } catch (error) {
      setStatus("error");
      setMessage("An error occurred while denying the delete request");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        {status === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Deny Delete Request</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Denial Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Enter the reason for denying this delete request..."
                required
              />
            </div>
            {message && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                {message}
              </div>
            )}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/placements")}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Deny Delete Request
              </button>
            </div>
          </form>
        )}

        {status === "loading" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing denial...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete Request Denied</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => router.push("/dashboard/placements")}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Go to Placements
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => router.push("/dashboard/placements")}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Go to Placements
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
