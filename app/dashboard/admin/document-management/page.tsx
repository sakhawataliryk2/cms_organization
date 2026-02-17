"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FiChevronRight, FiX } from "react-icons/fi";

interface Section {
  id: string;
  name: string;
  description: string;
}

const SECTIONS: Section[] = [
  {
    id: "onboarding",
    name: "OnBoarding",
    description:
      "Template documents for onboarding; create, edit, and map documents used in onboarding flows (including document packets).",
  },
  {
    id: "organization",
    name: "Organization",
    description:
      "Organization welcome document and default documents for new organizations. Fetching for new records of organization is applied here.",
  },
];

export default function DocumentManagementPage() {
  const router = useRouter();

  const handleSectionClick = (sectionId: string) => {
    router.push(`/dashboard/admin/document-management/${sectionId}`);
  };

  const handleClose = () => {
    router.push("/dashboard/admin");
  };

  return (
    <div className="bg-gray-200 min-h-screen p-8 relative">
                    <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Close"
        title="Close"
      >
        <FiX className="w-6 h-6" />
                          </button>

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Document Management</h2>
        <p className="text-gray-600 mt-1">
          Manage template documents, onboarding documents, and organization default documents. Each section is separate and works independently.
        </p>
            </div>

      <div className="max-w-2xl">
        {SECTIONS.map((section) => (
          <div key={section.id} className="mb-1">
            <button
              onClick={() => handleSectionClick(section.id)}
              className="w-full flex items-center text-left text-black hover:bg-gray-300 p-3 rounded transition"
            >
              <span className="w-4 h-4 mr-3 flex items-center justify-center shrink-0">
                <FiChevronRight size={16} />
              </span>
              <span className="flex-1">
                <span className="text-base font-medium block">
                  {section.name}
                </span>
                <span className="text-sm text-gray-600 font-normal">
                  {section.description}
                </span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
