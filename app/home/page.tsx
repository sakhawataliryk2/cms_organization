"use client";

import DashboardNav from "@/components/DashboardNav";
import Link from "next/link";
import { FiSettings } from "react-icons/fi";

export default function HomePage() {
  return (
    <div className="flex">
      <DashboardNav />
      <div className="flex-1 min-h-screen bg-white pl-60">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold mb-4">Welcome to Home</h1>
          <div className="flex justify-end">
            <Link
              href="/dashboard/"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              <FiSettings size={18} />
              <span>Admin Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
