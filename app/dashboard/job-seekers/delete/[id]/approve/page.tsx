"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCookie } from "cookies-next";

export default function ApproveJobSeekerDeletePage() {
  const params = useParams();
  const router = useRouter();
  const deleteRequestId = params?.id as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!deleteRequestId) return;

    const approveDelete = async () => {
      try {
        const token = getCookie("token");
        if (!token) {
          setStatus("error");
          setMessage("Authentication required. Please log in.");
          return;
        }

        const response = await fetch(`/api/job-seekers/delete/${deleteRequestId}/approve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Delete request approved successfully!");
        } else {
          setStatus("error");
          setMessage(data.message || "Failed to approve delete request");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An error occurred while approving the delete request");
      }
    };

    approveDelete();
  }, [deleteRequestId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        {status === "loading" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing approval...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete Request Approved</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500 mb-4">
              The job seeker record has been archived and will be permanently deleted after 7 days.
            </p>
            <button
              onClick={() => router.push("/dashboard/job-seekers")}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Go to Job Seekers
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
              onClick={() => router.push("/dashboard/job-seekers")}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Go to Job Seekers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
