"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { getUser } from "@/lib/auth";
import {
  readPermissionCache,
  writePermissionCache,
} from "@/lib/permissions/permissionStorage";

export type PermissionScope = "all" | "own" | "assigned" | "team" | "office";

export interface PermissionEntry {
  granted: boolean;
  scope: PermissionScope;
}

interface PermissionContextType {
  permissions: Record<string, PermissionEntry>;
  isSuper: boolean;
  isLoading: boolean;
  can: (
    code: string,
    options?: { record?: { created_by?: number | string | null; assigned_to?: number | string | null } }
  ) => boolean;
  getScope: (code: string) => PermissionScope | null;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(
  undefined
);

const PERMISSION_FETCH_TIMEOUT_MS = 15_000;

async function fetchPermissionsFromApi(): Promise<{
  permissions: Record<string, PermissionEntry>;
  isSuper: boolean;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    PERMISSION_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch("/api/users/me/permissions", {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Failed to load permissions");
    }

    const data = await response.json();
    return {
      permissions: data.permissions || {},
      isSuper: Boolean(data.isSuper),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<
    Record<string, PermissionEntry>
  >({});
  const [isSuper, setIsSuper] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useLayoutEffect(() => {
    const userId = getUser()?.id;
    const cached = readPermissionCache(userId);
    if (!cached) return;

    setPermissions(cached.permissions);
    setIsSuper(cached.isSuper);
    setIsLoading(false);
  }, []);

  const refreshPermissions = useCallback(async () => {
    const userId = getUser()?.id;
    const cached = readPermissionCache(userId);

    if (!cached) {
      setIsLoading(true);
    }

    try {
      const result = await fetchPermissionsFromApi();
      setPermissions(result.permissions);
      setIsSuper(result.isSuper);
      writePermissionCache(userId, result.permissions, result.isSuper);
    } catch (error) {
      console.error("Error loading permissions:", error);
      if (!cached) {
        setPermissions({});
        setIsSuper(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  const getScope = useCallback(
    (code: string): PermissionScope | null => {
      if (isSuper) return "all";
      const entry = permissions[code];
      if (!entry || entry.granted === false) return null;
      return entry.scope || "all";
    },
    [permissions, isSuper]
  );

  const can = useCallback(
    (
      code: string,
      options?: {
        record?: {
          created_by?: number | string | null;
          assigned_to?: number | string | null;
        };
      }
    ) => {
      if (isSuper) return true;

      const entry = permissions[code];
      if (!entry || entry.granted === false) return false;

      const scope = entry.scope || "all";
      const record = options?.record;
      if (!record || scope === "all") return true;

      const currentUserId = getUser()?.id;
      if (!currentUserId) return false;

      if (scope === "own") {
        return Number(record.created_by) === Number(currentUserId);
      }

      if (scope === "assigned") {
        return (
          Number(record.assigned_to) === Number(currentUserId) ||
          Number(record.created_by) === Number(currentUserId)
        );
      }

      if (scope === "team" || scope === "office") {
        return false;
      }

      return false;
    },
    [permissions, isSuper]
  );

  const value = useMemo(
    () => ({
      permissions,
      isSuper,
      isLoading,
      can,
      getScope,
      refreshPermissions,
    }),
    [permissions, isSuper, isLoading, can, getScope, refreshPermissions]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}

export function useCan(code: string) {
  const { can, isLoading } = usePermissions();
  return { allowed: can(code), isLoading };
}
