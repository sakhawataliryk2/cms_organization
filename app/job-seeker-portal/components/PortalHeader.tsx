"use client";

import { FiHelpCircle, FiUser, FiLogOut } from "react-icons/fi";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation"; 
import ProfileModal from "../components/ProfileModal"; // Import ProfileModal component

interface PortalHeaderProps {
  userName: string;
}

export default function PortalHeader({ userName }: PortalHeaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false); // State to manage modal visibility
  const router = useRouter();

  const navigateToProfile = () => {
    setIsModalOpen(true); // Open modal
  };

  const closeModal = () => {
    setIsModalOpen(false); // Close modal
  };

  return (
    <div className="h-14 bg-[#1d2945] text-white flex items-center">
      <div className="max-w-[1200px] mx-auto w-full px-4 flex items-center justify-between">
        <div className="font-semibold">{userName}</div>

        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <FiHelpCircle size={18} />
          </button>

          {/* Profile Button - Triggers modal */}
          <button
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Profile"
            onClick={navigateToProfile} // Open profile modal
          >
            <FiUser size={18} />
          </button>

          <button
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            onClick={() => (window.location.href = "/job-seeker-portal/login")}
          >
            <FiLogOut size={18} />
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={isModalOpen} closeModal={closeModal} />
    </div>
  );
}