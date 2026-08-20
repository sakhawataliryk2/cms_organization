import { getUser } from "@/lib/auth";

const SUPER_USER_TYPES = new Set([
  "owner",
  "admin",
  "administrator",
  "developer",
]);

export function isSuperUserType(userType?: string | null): boolean {
  if (!userType) return false;
  return SUPER_USER_TYPES.has(String(userType).trim().toLowerCase());
}

export function inferIsSuperFromUser(): boolean {
  return isSuperUserType(getUser()?.userType);
}
