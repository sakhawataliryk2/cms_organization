"use client";

import { useEffect, useState } from "react";
import { FiMail, FiPhone, FiBriefcase, FiUser } from "react-icons/fi";
import LoadingState from "@/components/portal/LoadingState";

export default function HiringProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/hiring/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProfile(d?.profile || null))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Loading profile..." />;
  if (!profile) return (
    <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600 text-center">
      Profile not available.
    </div>
  );

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const initials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const custom = typeof profile.custom_fields === "string"
    ? (() => { try { return JSON.parse(profile.custom_fields); } catch { return {}; } })()
    : profile.custom_fields || {};

  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
        <div className="bg-[#1d2945] p-6 text-white">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {initials || <FiUser size={24} />}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{fullName || "Unnamed User"}</h2>
              <p className="text-blue-200 flex items-center gap-2 mt-1 text-sm">
                <FiBriefcase size={14} />
                {profile.title || "Hiring Manager"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Contact Information</h3>
            {profile.email && (
              <div className="flex items-start gap-3">
                <FiMail className="mt-0.5 text-blue-600 shrink-0" size={16} />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-900">{profile.email}</p>
                </div>
              </div>
            )}
            {profile.email2 && (
              <div className="flex items-start gap-3">
                <FiMail className="mt-0.5 text-blue-600 shrink-0" size={16} />
                <div>
                  <p className="text-xs text-slate-500">Secondary Email</p>
                  <p className="text-sm font-medium text-slate-900">{profile.email2}</p>
                </div>
              </div>
            )}
            {(profile.phone || custom["Phone"]) && (
              <div className="flex items-start gap-3">
                <FiPhone className="mt-0.5 text-blue-600 shrink-0" size={16} />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm font-medium text-slate-900">{profile.phone || custom["Phone"]}</p>
                </div>
              </div>
            )}
          </div>

          {Object.keys(custom).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Additional Details</h3>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(custom).slice(0, 6).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-slate-500">{key}</p>
                    <p className="text-sm font-medium text-slate-900">{String(val || "—")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {profile.record_number && (
          <div className="bg-slate-50 px-6 py-3 text-xs text-slate-400 border-t">
            Record #{profile.record_number}
          </div>
        )}
      </div>
    </div>
  );
}
