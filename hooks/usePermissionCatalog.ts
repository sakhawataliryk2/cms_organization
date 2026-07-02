"use client";

import { useCallback, useEffect, useState } from "react";
import type { PermissionSelection } from "@/lib/permissions/types";

export interface PermissionCatalogGroup {
  module: string;
  label: string;
  permissions: Array<{
    code: string;
    description: string;
    category?: string;
    action?: string;
  }>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export function usePermissionCatalog() {
  const [groups, setGroups] = useState<PermissionCatalogGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ groups: PermissionCatalogGroup[] }>(
        "/api/permissions/catalog"
      );
      setGroups(data.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return { groups, isLoading, error, reload: loadCatalog };
}

export async function fetchRoleTemplate(
  roleCode: string
): Promise<{ isSuper: boolean; permissions: PermissionSelection[] }> {
  const data = await fetchJson<{
    isSuper?: boolean;
    permissions?: PermissionSelection[];
  }>(`/api/permissions/roles/${encodeURIComponent(roleCode)}/template`);
  return {
    isSuper: Boolean(data.isSuper),
    permissions: data.permissions || [],
  };
}

export async function fetchUserPermissions(
  userId: string | number
): Promise<{
  source: "user" | "template";
  isSuper?: boolean;
  permissions: PermissionSelection[];
}> {
  const data = await fetchJson<{
    source?: "user" | "template";
    isSuper?: boolean;
    permissions?: PermissionSelection[];
  }>(`/api/users/${userId}/permissions`);
  return {
    source: data.source === "user" ? "user" : "template",
    isSuper: data.isSuper,
    permissions: data.permissions || [],
  };
}
