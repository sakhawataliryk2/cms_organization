"use client";

import DashboardNav from "@/components/DashboardNav";


export default function HomePage() {
  return (
    <div className="flex">
      <DashboardNav />
      <div className="flex-1 min-h-screen bg-white pl-60">
        <h1 className="text-2xl font-bold p-4">Welcome to Home</h1>
      </div>
    </div>
  );
}
