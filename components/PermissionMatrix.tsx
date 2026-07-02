"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchRoleTemplate,
  fetchUserPermissions,
  usePermissionCatalog,
} from "@/hooks/usePermissionCatalog";
import {
  isScopedPermission,
  type PermissionScope,
  type PermissionSelection,
} from "@/lib/permissions/types";

const SCOPES: PermissionScope[] = ["all", "own", "assigned", "team", "office"];

interface PermissionMatrixProps {
  roleCode: string;
  userId?: string | number;
  value: PermissionSelection[];
  onChange: (permissions: PermissionSelection[]) => void;
}

function selectionMap(
  permissions: PermissionSelection[]
): Map<string, PermissionSelection> {
  return new Map(permissions.map((entry) => [entry.code, entry]));
}

export default function PermissionMatrix({
  roleCode,
  userId,
  value,
  onChange,
}: PermissionMatrixProps) {
  const { groups, isLoading: catalogLoading, error: catalogError } =
    usePermissionCatalog();
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<"user" | "template" | "role">("role");
  const [searchQuery, setSearchQuery] = useState("");

  const grantedByCode = useMemo(() => selectionMap(value), [value]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groups;

    return groups
      .map((group) => {
        const labelMatch = group.label.toLowerCase().includes(normalizedSearch);
        const moduleMatch = group.module.toLowerCase().includes(normalizedSearch);
        const permissions = group.permissions.filter((permission) => {
          if (labelMatch || moduleMatch) return true;
          return (
            permission.description.toLowerCase().includes(normalizedSearch) ||
            permission.code.toLowerCase().includes(normalizedSearch)
          );
        });
        return { ...group, permissions };
      })
      .filter((group) => group.permissions.length > 0);
  }, [groups, normalizedSearch]);

  useEffect(() => {
    if (!normalizedSearch) return;
    setExpanded((prev) => {
      const next = { ...prev };
      for (const group of filteredGroups) {
        next[group.module] = true;
      }
      return next;
    });
  }, [normalizedSearch, filteredGroups]);

  const loadPermissions = useCallback(
    async (opts?: { forceTemplate?: boolean }) => {
      setLoadingTemplate(true);
      try {
        if (userId && !opts?.forceTemplate) {
          const userData = await fetchUserPermissions(userId);
          setSource(userData.source);
          setIsSuper(Boolean(userData.isSuper));
          onChange(userData.permissions);
          return;
        }
        const template = await fetchRoleTemplate(roleCode);
        setSource("role");
        setIsSuper(template.isSuper);
        onChange(template.permissions);
      } catch (error) {
        console.error("Failed to load permissions:", error);
      } finally {
        setLoadingTemplate(false);
      }
    },
    [userId, roleCode, onChange]
  );

  useEffect(() => {
    void loadPermissions();
    // Remount via `key` when roleCode/userId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePermission = (code: string, granted: boolean) => {
    const existing = grantedByCode.get(code);
    const scope = existing?.scope || "all";
    const next = new Map(grantedByCode);
    if (granted) {
      next.set(code, { code, granted: true, scope });
    } else {
      next.delete(code);
    }
    onChange(Array.from(next.values()));
  };

  const setScope = (code: string, scope: PermissionScope) => {
    const existing = grantedByCode.get(code);
    if (!existing) return;
    const next = new Map(grantedByCode);
    next.set(code, { ...existing, scope });
    onChange(Array.from(next.values()));
  };

  const toggleModule = (moduleKey: string, grant: boolean) => {
    const group = groups.find((g) => g.module === moduleKey);
    if (!group) return;
    const next = new Map(grantedByCode);
    for (const permission of group.permissions) {
      if (grant) {
        const existing = next.get(permission.code);
        next.set(permission.code, {
          code: permission.code,
          granted: true,
          scope: existing?.scope || "all",
        });
      } else {
        next.delete(permission.code);
      }
    }
    onChange(Array.from(next.values()));
  };

  const grantAllPermissions = () => {
    const all = groups.flatMap((group) =>
      group.permissions.map((permission) => ({
        code: permission.code,
        granted: true,
        scope: grantedByCode.get(permission.code)?.scope || "all",
      }))
    );
    onChange(all);
    setSource("user");
  };

  const clearAllPermissions = () => {
    onChange([]);
    setSource("user");
  };

  if (catalogLoading || loadingTemplate) {
    return (
      <div className="text-sm text-gray-500 py-4">Loading permissions...</div>
    );
  }

  if (catalogError) {
    return (
      <div className="text-sm text-red-600 py-4">{catalogError}</div>
    );
  }

  if (isSuper) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        This role has full system access. All permissions are granted automatically.
      </div>
    );
  }

  const grantedCount = value.filter((entry) => entry.granted).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Permissions</h3>
          <p className="text-xs text-gray-500">
            {grantedCount} granted
            {source === "user" ? " (custom overrides saved)" : " (from role template)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={grantAllPermissions}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-blue-600"
          >
            All
          </button>
          <button
            type="button"
            onClick={clearAllPermissions}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
          >
            None
          </button>
          <button
            type="button"
            onClick={() => void loadPermissions({ forceTemplate: true })}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
          >
            Reset to role template
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search permissions by name, code, or module..."
          className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
        {filteredGroups.length === 0 ? (
          <div className="px-3 py-6 text-sm text-gray-500 text-center">
            No permissions match &quot;{searchQuery.trim()}&quot;
          </div>
        ) : (
        filteredGroups.map((group) => {
          const isOpen = expanded[group.module] ?? false;
          const moduleGranted = group.permissions.filter((p) =>
            grantedByCode.get(p.code)?.granted
          ).length;

          return (
            <div key={group.module}>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [group.module]: !isOpen,
                    }))
                  }
                  className="text-sm font-medium text-gray-800 flex-1 text-left"
                >
                  {isOpen ? "▾" : "▸"} {group.label}
                  <span className="text-xs text-gray-500 ml-2">
                    ({moduleGranted}/{group.permissions.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleModule(group.module, true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => toggleModule(group.module, false)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  None
                </button>
              </div>

              {isOpen && (
                <div className="px-3 py-2 space-y-2">
                  {group.permissions.map((permission) => {
                    const entry = grantedByCode.get(permission.code);
                    const checked = Boolean(entry?.granted);
                    const showScope =
                      checked && isScopedPermission(permission.code);

                    return (
                      <div
                        key={permission.code}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <label className="flex items-start gap-2 flex-1 min-w-[200px]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              togglePermission(permission.code, e.target.checked)
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <span className="text-gray-900">
                              {permission.description}
                            </span>
                            <span className="block text-xs text-gray-400 font-mono">
                              {permission.code}
                            </span>
                          </span>
                        </label>
                        {showScope && (
                          <select
                            value={entry?.scope || "all"}
                            onChange={(e) =>
                              setScope(
                                permission.code,
                                e.target.value as PermissionScope
                              )
                            }
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            {SCOPES.map((scope) => (
                              <option key={scope} value={scope}>
                                {scope}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
