"use client";

import { useEffect, useState } from "react";
import { FiMail, FiPhone, FiMapPin, FiBriefcase, FiUser } from "react-icons/fi";
import LoadingState from "@/components/portal/LoadingState";

export default function JobSeekerProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/jobseeker/profile", { cache: "no-store" })
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
  const custom = typeof profile.custom_fields === "string"
    ? (() => { try { return JSON.parse(profile.custom_fields); } catch { return {}; } })()
    : profile.custom_fields || {};

  const initials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join("").toUpperCase();

  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

      {/* Header card */}
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
                {profile.title || "Job Seeker"} • {profile.status || "Active"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-8">
          {/* Contact info */}
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
            {(profile.phone || profile.mobile_phone) && (
              <div className="flex items-start gap-3">
                <FiPhone className="mt-0.5 text-blue-600 shrink-0" size={16} />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm font-medium text-slate-900">{profile.phone || profile.mobile_phone}</p>
                </div>
              </div>
            )}
            {(profile.city || profile.state || profile.address) && (
              <div className="flex items-start gap-3">
                <FiMapPin className="mt-0.5 text-blue-600 shrink-0" size={16} />
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm font-medium text-slate-900">
                    {[profile.city, profile.state, profile.zip].filter(Boolean).join(", ")}
                  </p>
                  {profile.address && <p className="text-xs text-slate-400">{profile.address}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Employment details */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Employment Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {profile.current_organization && (
                <div>
                  <p className="text-xs text-slate-500">Current Org</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{profile.current_organization}</p>
                </div>
              )}
              {custom["Employment Preference"] && (
                <div>
                  <p className="text-xs text-slate-500">Employment Pref.</p>
                  <p className="text-sm font-medium text-slate-900">{custom["Employment Preference"]}</p>
                </div>
              )}
              {custom["Department"] && (
                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="text-sm font-medium text-slate-900">{custom["Department"]}</p>
                </div>
              )}
              {custom["Date Available"] && (
                <div>
                  <p className="text-xs text-slate-500">Available From</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(custom["Date Available"]).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {profile.skills && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.split(",").map((s: string) => (
                    <span key={s} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                      {s.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {(profile.created_at || profile.record_number) && (
          <div className="bg-slate-50 px-6 py-3 text-xs text-slate-400 border-t flex justify-between">
            {profile.created_at && <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>}
            {profile.record_number && <span>Record #{profile.record_number}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
