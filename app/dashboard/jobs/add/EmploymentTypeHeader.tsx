"use client";

import { useRouter } from "nextjs-toploader/app";
import { usePathname } from "next/navigation";
import { FiEdit3 } from "react-icons/fi";

const formatEmploymentType = (value: string) => {
    return value
        ?.split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

const EmploymentTypeHeader = () => {
    const router = useRouter();
    const pathname = usePathname();

    const employmentSlug = pathname?.split("/").pop() || "";
    const employmentType = formatEmploymentType(employmentSlug);

    return (
        <div className="w-full border-b border-slate-200 pb-4">
            {/* Label */}
            <div className="font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
                EMPLOYMENT TYPE
            </div>

            {/* Value + Edit */}
            <div className="flex items-center gap-2">
                <span className="text-[16px] font-medium text-slate-900">
                    {employmentType}
                </span>

                <button
                    type="button"
                    onClick={() => router.push("/dashboard/jobs/add")}
                    className="text-slate-400 hover:text-slate-700 transition"
                    aria-label="Change employment type"
                >
                    <FiEdit3 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default EmploymentTypeHeader;