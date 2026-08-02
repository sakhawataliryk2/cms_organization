"use client";

import { useEffect, useState } from "react";
import { FiBriefcase, FiMail, FiPhone, FiUser } from "react-icons/fi";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-[#d8dde3] bg-white py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a6bb5] border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-[#d8dde3] bg-white p-8 text-center text-sm text-[#7a8490]">
        Profile not available.
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const initials = [profile.first_name?.[0], profile.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
  const custom =
    typeof profile.custom_fields === "string"
      ? (() => {
          try {
            return JSON.parse(profile.custom_fields);
          } catch {
            return {};
          }
        })()
      : profile.custom_fields || {};

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-[#d8dde3] bg-white">
        <div className="bg-[#001B3A] px-6 py-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-xl font-bold">
              {initials || <FiUser size={22} />}
            </div>
            <div>
              <h1 className="text-[22px] font-semibold">{fullName || "Hiring Manager"}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-[14px] text-white/80">
                <FiBriefcase size={14} />
                {profile.title || "Hiring Manager"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="border-b border-[#e6ebf0] pb-2 text-[14px] font-semibold text-[#1a1a1a]">
              Contact Information
            </h2>
            {profile.email && (
              <div className="flex items-start gap-3">
                <FiMail className="mt-0.5 shrink-0 text-[#1a6bb5]" size={16} />
                <div>
                  <p className="text-[12px] text-[#7a8490]">Email</p>
                  <p className="text-[14px] font-medium text-[#1a1a1a]">{profile.email}</p>
                </div>
              </div>
            )}
            {profile.email2 && (
              <div className="flex items-start gap-3">
                <FiMail className="mt-0.5 shrink-0 text-[#1a6bb5]" size={16} />
                <div>
                  <p className="text-[12px] text-[#7a8490]">Secondary Email</p>
                  <p className="text-[14px] font-medium text-[#1a1a1a]">{profile.email2}</p>
                </div>
              </div>
            )}
            {(profile.phone || custom.Phone) && (
              <div className="flex items-start gap-3">
                <FiPhone className="mt-0.5 shrink-0 text-[#1a6bb5]" size={16} />
                <div>
                  <p className="text-[12px] text-[#7a8490]">Phone</p>
                  <p className="text-[14px] font-medium text-[#1a1a1a]">
                    {profile.phone || custom.Phone}
                  </p>
                </div>
              </div>
            )}
          </div>

          {Object.keys(custom).length > 0 && (
            <div className="space-y-4">
              <h2 className="border-b border-[#e6ebf0] pb-2 text-[14px] font-semibold text-[#1a1a1a]">
                Additional Details
              </h2>
              <div className="grid gap-3">
                {Object.entries(custom)
                  .slice(0, 6)
                  .map(([key, val]) => (
                    <div key={key}>
                      <p className="text-[12px] text-[#7a8490]">{key}</p>
                      <p className="text-[14px] font-medium text-[#1a1a1a]">
                        {String(val || "—")}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {profile.record_number != null && (
          <div className="border-t border-[#e6ebf0] bg-[#f7f8fa] px-6 py-3 text-[12px] text-[#9aa3ad]">
            Record #{profile.record_number}
          </div>
        )}
      </div>
    </div>
  );
}
