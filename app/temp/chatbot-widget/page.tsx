"use client";

import { useMemo, useState } from "react";
import ChatbotWidgetMockup from "@/components/ChatbotWidgetMockup";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export default function ChatbotWidgetDemoPage() {
  const [urlInput, setUrlInput] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const siteLabel = useMemo(
    () => (previewUrl ? hostnameFromUrl(previewUrl) : ""),
    [previewUrl],
  );

  const handlePersonalize = () => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) {
      setError("Enter a valid website URL (e.g. completestaffingsolutions.com)");
      return;
    }
    setError("");
    setPreviewUrl(normalized);
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setError("");
  };

  if (!previewUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Temporary demo
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Chatbot widget preview
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter a site URL and personalize to see the same embeddable chatbot on that page.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/60">
            <label className="block text-sm font-medium text-gray-700" htmlFor="site-url">
              Website URL
            </label>
            <input
              id="site-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePersonalize()}
              placeholder="https://example.com"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
            />

            <label
              className="mt-4 block text-sm font-medium text-gray-700"
              htmlFor="company-name"
            >
              Company name <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
            />

            {error ? (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={handlePersonalize}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Personalize
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Route: <code className="rounded bg-gray-100 px-1.5 py-0.5">/temp/chatbot-widget</code>
          </p>
        </div>

        {/* Same widget on setup screen so users see it before personalizing */}
        <ChatbotWidgetMockup companyName={companyName || undefined} siteLabel="Preview" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-900">
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-gray-900/95 px-4 py-3 text-white backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{siteLabel}</p>
          <p className="truncate text-xs text-gray-400">{previewUrl}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
        >
          Change URL
        </button>
      </div>

      <iframe
        title={`Preview of ${siteLabel}`}
        src={previewUrl}
        className="h-full w-full border-0 pt-14"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      <ChatbotWidgetMockup
        companyName={companyName || undefined}
        siteLabel={siteLabel}
      />
    </div>
  );
}
