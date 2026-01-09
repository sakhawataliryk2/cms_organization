// app/job-seeker-portal/components/PortalHeader.tsx
"use client";

import { FiHelpCircle, FiUser, FiLogOut } from "react-icons/fi";

export default function PortalHeader({ userName }: { userName: string }) {
  return (
    <div className="h-14 bg-[#1d2945] text-white flex items-center">
      <div className="max-w-[1200px] mx-auto w-full px-4 flex items-center justify-between">
        {/* Left: Username */}
        <div className="font-semibold">{userName}</div>

        {/* Right: Icons */}
        <div className="flex items-center gap-3">
          {/* Help */}
          <button
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Help"
            onClick={() => alert("Help")}
          >
            <FiHelpCircle size={18} />
          </button>

          {/* Profile */}
          <button
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Profile"
            onClick={() => alert("Profile")}
          >
            <FiUser size={18} />
          </button>

          {/* Logout */}
          <button
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Logout"
            onClick={() => (window.location.href = "/job-seeker-portal/login")}
          >
            <FiLogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
