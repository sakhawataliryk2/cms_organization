"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiUser, FiMail, FiPhone, FiMapPin, FiBriefcase, FiX } from "react-icons/fi"; // Close button (FiX)
import { useRouter } from "next/navigation"; 

export default function ProfileModal({ isOpen, closeModal }: { isOpen: boolean; closeModal: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/job-seeker-portal/profile`);
        const data = await res.json();

        if (data.success) {
          setProfile(data.profile);
        } else {
          toast.error(data.message || "Failed to load profile");
        }
      } catch (err) {
        toast.error("An error occurred while fetching profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse text-gray-500">Loading your profile...</div>;
  if (!profile) return <div className="p-10 text-center text-red-500">No profile data found.</div>;

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
  const custom = profile.custom_fields || {};

  return (
    isOpen && (
      <div className="fixed inset-0 bg-white/80 bg-opacity-40 z-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg max-w-4xl mx-auto relative">
          {/* Close Button in Top Right */}
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            title="Close Modal"
          >
            <FiX size={24} />
          </button>

          <div className="bg-[#1d2945] p-8 text-white">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white/20 rounded-full text-white flex items-center justify-center text-3xl font-bold uppercase">
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{fullName || "Unnamed User"}</h1>
                <p className="text-blue-200 flex items-center gap-2 mt-1">
                  <FiBriefcase /> {profile.title || "Job Seeker"} • {profile.status}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 grid md:grid-cols-2 gap-8">
            {/* Left Column: Personal Info */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2 text-black">Contact Information</h2>
              <div className="flex items-start gap-4">
                <FiMail className="mt-1 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="font-medium text-black">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <FiPhone className="mt-1 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Mobile Phone</p>
                  <p className="font-medium text-black">{profile.mobile_phone || "Not provided"}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <FiMapPin className="mt-1 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-black">
                    {profile.city}, {profile.state} {profile.zip}
                  </p>
                  <p className="text-sm text-gray-400">{profile.address}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Work/Additional Info */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2 text-black">Employment Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Employment Pref.</p>
                  <p className="font-medium text-black">{custom["Employment Preference"] || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium text-black">{custom["Department"] || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Org</p>
                  <p className="font-medium text-black truncate">{profile.current_organization || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Available From</p>
                  <p className="font-medium text-black">
                    {custom["Date Available"] ? new Date(custom["Date Available"]).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {profile.skills ? (
                    profile.skills.split(',').map((skill: string) => (
                      <span key={skill} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                        {skill.trim()}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 italic text-sm">No skills listed</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer info */}
          <div className="bg-gray-50 px-8 py-4 text-xs text-gray-400 border-t flex justify-between">
            <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
            <span>Record #{profile.record_number}</span>
          </div>
        </div>
      </div>
    )
  );
}