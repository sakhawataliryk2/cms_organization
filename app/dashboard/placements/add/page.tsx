// app/dashboard/placements/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function AddPlacementLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedType, setSelectedType] = useState<string>("");

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const redirectForEdit = async () => {
      try {
        const res = await fetch(`/api/placements/${id}`);
        if (!res.ok) {
          router.replace(`/dashboard/placements/add/contract?id=${id}`);
          return;
        }
        const data = await res.json();
        const type = String(data?.placement?.placement_type || "").toLowerCase();
        let segment = "contract";
        if (type.includes("direct")) segment = "direct-hire";
        else if (type.includes("executive")) segment = "executive-search";
        router.replace(`/dashboard/placements/add/${segment}?id=${id}`);
      } catch {
        router.replace(`/dashboard/placements/add/contract?id=${id}`);
      }
    };
    redirectForEdit();
  }, [searchParams, router]);

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    
    // Preserve existing query params
    const params = new URLSearchParams(searchParams.toString());
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : "";

    router.push(`/dashboard/placements/add/${type}${query}`);
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-red-600 pb-4 mb-6">
          <div className="flex items-center">
            <div className="bg-red-100 border border-red-300 p-2 mr-3">
              <Image src="/window.svg" alt="Placement" width={24} height={24} className="text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Add Placement</h1>
          </div>
          <button
            onClick={handleGoBack}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            X
          </button>
        </div>

        {/* Placement Type Options */}
        <div className="p-6">
          <p className="text-gray-600 mb-6 font-medium text-center">Please select a placement type to continue</p>
          <div className="flex flex-col sm:flex-row gap-4">

            {/* Contract */}
            <label
              className={`flex-1 border-2 rounded-lg p-6 cursor-pointer transition-all ${
                selectedType === "contract"
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-blue-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <input
                  type="radio"
                  name="placementType"
                  value="contract"
                  checked={selectedType === "contract"}
                  onChange={(e) => handleTypeSelect(e.target.value)}
                  className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-lg font-semibold text-gray-800">
                  Placement Contract
                </span>
                <p className="text-sm text-gray-500">Standard contract based placement</p>
              </div>
            </label>

            {/* Direct Hire */}
            <label
              className={`flex-1 border-2 rounded-lg p-6 cursor-pointer transition-all ${
                selectedType === "direct-hire"
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-blue-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <input
                  type="radio"
                  name="placementType"
                  value="direct-hire"
                  checked={selectedType === "direct-hire"}
                  onChange={(e) => handleTypeSelect(e.target.value)}
                  className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-lg font-semibold text-gray-800">
                  Placement Direct Hire
                </span>
                <p className="text-sm text-gray-500">Direct hiring placement for long-term</p>
              </div>
            </label>

            {/* Executive Search */}
            <label
              className={`flex-1 border-2 rounded-lg p-6 cursor-pointer transition-all ${
                selectedType === "executive-search"
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-blue-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <input
                  type="radio"
                  name="placementType"
                  value="executive-search"
                  checked={selectedType === "executive-search"}
                  onChange={(e) => handleTypeSelect(e.target.value)}
                  className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-lg font-semibold text-gray-800">
                  Placement Executive Search
                </span>
                <p className="text-sm text-gray-500">High-level executive search placement</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
