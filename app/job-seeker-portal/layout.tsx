import type { ReactNode } from "react";

export const metadata = {
  title: "Job Seeker Portal",
};

export default function JobSeekerPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-white">
      {children}
    </div>
  );
}
