"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function FillAndSignPage() {
  const params = useSearchParams();
  const itemId = String(params?.get("itemId") || "");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!itemId || !signature.trim()) {
      setMessage("Signature is required.");
      return;
    }
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/portal/jobseeker/documents/${itemId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setMessage(res?.ok && data?.success ? "Signed successfully." : data?.message || "Failed to sign.");
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Fill & Sign</h2>
      <p className="mt-1 text-sm text-slate-600">Document item: {itemId || "N/A"}</p>
      <div className="mt-4 max-w-md">
        <label className="mb-1 block text-sm font-medium text-slate-700">E-signature</label>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          placeholder="Type your full name"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit & Sign"}
        </button>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}

