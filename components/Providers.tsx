"use client";

import { ReactNode } from "react";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { MultipleAddProvider } from "@/contexts/MultipleAddContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PermissionProvider>
      <MultipleAddProvider>{children}</MultipleAddProvider>
    </PermissionProvider>
  );
}
