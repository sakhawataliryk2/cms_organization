import type { PermissionEntry } from "@/contexts/PermissionContext";

const CACHE_KEY = "cms_permissions_cache";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface PermissionCache {
  userId: string;
  permissions: Record<string, PermissionEntry>;
  isSuper: boolean;
  cachedAt: number;
}

export function readPermissionCache(
  userId: string | number | undefined | null
): PermissionCache | null {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as PermissionCache;
    if (data.userId !== String(userId)) return null;
    if (Date.now() - data.cachedAt > CACHE_TTL_MS) return null;

    return data;
  } catch {
    return null;
  }
}

export function writePermissionCache(
  userId: string | number | undefined | null,
  permissions: Record<string, PermissionEntry>,
  isSuper: boolean
): void {
  if (!userId || typeof window === "undefined") return;

  try {
    const payload: PermissionCache = {
      userId: String(userId),
      permissions,
      isSuper,
      cachedAt: Date.now(),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private mode errors
  }
}

export function clearPermissionCache(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore sessionStorage errors
  }
}
