import type { ReactNode } from "react";

export default function DocumentManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-gray-200 min-h-screen p-4">
      {/* <DocumentMgmtTabs /> */}
      {children}
    </div>
  );
}
