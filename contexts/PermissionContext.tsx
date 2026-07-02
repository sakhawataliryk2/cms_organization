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
import { inferIsSuperFromUser } from "@/lib/permissions/superUser";

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
    options?: {
      record?: {
        created_by?: number | string | null;
        assigned_to?: number | string | null;
      };
    }
  ) => boolean;
  getScope: (code: string) => PermissionScope | null;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(
  undefined
);

type PermissionFetchResult =
  | {
      ok: true;
      permissions: Record<string, PermissionEntry>;
      isSuper: boolean;
    }
  | { ok: false };

function resolveIsSuper(apiValue: boolean): boolean {
  return apiValue || inferIsSuperFromUser();
}

async function fetchPermissionsFromApi(): Promise<PermissionFetchResult> {
  try {
    const response = await fetch("/api/users/me/permissions", {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false };
    }

    return {
      ok: true,
      permissions: data.permissions || {},
      isSuper: resolveIsSuper(Boolean(data.isSuper)),
    };
  } catch {
    return { ok: false };
  }
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Record<string, PermissionEntry>>(
    {}
  );
  const [isSuper, setIsSuper] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useLayoutEffect(() => {
    const userId = getUser()?.id;
    const cached = readPermissionCache(userId);
    if (cached) {
      setPermissions(cached.permissions);
      setIsSuper(resolveIsSuper(cached.isSuper));
      setIsLoading(false);
      return;
    }

    if (inferIsSuperFromUser()) {
      setIsSuper(true);
      setIsLoading(false);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    const userId = getUser()?.id;
    const cached = readPermissionCache(userId);

    if (!cached && !inferIsSuperFromUser()) {
      setIsLoading(true);
    }

    const result = await fetchPermissionsFromApi();

    if (result.ok) {
      setPermissions(result.permissions);
      setIsSuper(result.isSuper);
      writePermissionCache(userId, result.permissions, result.isSuper);
    } else if (cached) {
      setIsSuper(resolveIsSuper(cached.isSuper));
    } else {
      const inferredSuper = inferIsSuperFromUser();
      setPermissions({});
      setIsSuper(inferredSuper);
      if (inferredSuper) {
        writePermissionCache(userId, {}, true);
      }
    }

    setIsLoading(false);
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
