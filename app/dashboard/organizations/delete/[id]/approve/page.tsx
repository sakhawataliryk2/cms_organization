"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCookie } from "cookies-next";

export default function ApproveDeletePage() {
  const params = useParams();
  const router = useRouter();
  const deleteRequestId = params?.id as string;
  const [status, setStatus] = useState<"loading" | "review" | "approving" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<any>(null);

  useEffect(() => {
    if (!deleteRequestId) return;

    const fetchRequestDetails = async () => {
      try {
        const token = getCookie("token");
        if (!token) {
          setStatus("error");
          setMessage("Authentication required. Please log in.");
          return;
        }

        const response = await fetch(`/api/organizations/delete/${deleteRequestId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setDeleteRequest(data.deleteRequest);
          if (data.deleteRequest.status === 'pending') {
            setStatus("review");
          } else {
            setStatus("error");
            setMessage(`This request is already ${data.deleteRequest.status}.`);
          }
        } else {
          setStatus("error");
          setMessage(data.message || "Failed to fetch delete request details");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An error occurred while fetching the delete request");
      }
    };

    fetchRequestDetails();
  }, [deleteRequestId]);

  const handleApprove = async () => {
    setStatus("approving");
    try {
      const token = getCookie("token");
      if (!token) {
        setStatus("error");
        setMessage("Authentication required. Please log in.");
        return;
      }

      const response = await fetch(`/api/organizations/delete/${deleteRequestId}/approve`, {
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

  const isCascade = deleteRequest?.action_type === 'cascade';
  const dependencies = deleteRequest?.dependencies_summary || {};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">

        {/* Header */}
        <div className={`p-6 border-b ${isCascade ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <h2 className={`text-xl font-bold ${isCascade ? 'text-red-800' : 'text-gray-800'}`}>
            {status === 'success' ? 'Request Approved' : (isCascade ? '⚠️ Cascade Delete Request' : 'Delete Request')}
          </h2>
        </div>

        <div className="p-6">
          {status === "loading" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading request details...</p>
            </div>
          )}

          {status === "review" && deleteRequest && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 border border-blue-100">
                You are reviewing a request to delete: <br />
                <strong>{deleteRequest.record_type} #{deleteRequest.record_number || deleteRequest.record_id}</strong>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-500">Requested By</p>
                <p className="font-medium">{deleteRequest.requested_by_name} ({deleteRequest.requested_by_email})</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-500">Reason</p>
                <p className="p-3 bg-gray-50 rounded text-gray-700 italic border border-gray-200">
                  "{deleteRequest.reason}"
                </p>
              </div>

              {isCascade && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Warning: Cascade Deletion
                  </h3>
                  <p className="text-sm text-red-700 mb-3">
                    This action will permanently delete the organization <strong>AND</strong> the following linked records:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-2">
                    {dependencies.hiring_managers > 0 && <li>{dependencies.hiring_managers} Hiring Managers</li>}
                    {dependencies.jobs > 0 && <li>{dependencies.jobs} Jobs</li>}
                    {dependencies.placements > 0 && <li>{dependencies.placements} Placements</li>}
                    {dependencies.child_organizations > 0 && <li>{dependencies.child_organizations} Child Organizations</li>}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t mt-6">
                <button
                  onClick={() => router.push("/dashboard/organizations")}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className={`flex-1 px-4 py-2 text-white rounded font-medium shadow-sm transition-colors ${isCascade ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                >
                  {isCascade ? 'Approve Cascade Delete' : 'Approve Delete'}
                </button>
              </div>
            </div>
          )}

          {status === "approving" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Processing approval...</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="bg-gray-50 p-4 rounded text-sm text-gray-500 mb-6">
                The record has been archived and will be permanently deleted after 7 days.
              </div>
              <button
                onClick={() => router.push("/dashboard/organizations")}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium w-full"
              >
                Go to Organizations
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
              <p className="text-red-600 mb-6">{message}</p>
              <button
                onClick={() => router.push("/dashboard/organizations")}
                className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 font-medium w-full"
              >
                Go to Organizations
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
