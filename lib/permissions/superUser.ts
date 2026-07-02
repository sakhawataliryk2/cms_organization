import { getUser } from "@/lib/auth";

const SUPER_USER_TYPES = new Set([
  "owner",
  "admin",
  "administrator",
  "developer",
]);

export function inferIsSuperFromUser(): boolean {
  const userType = getUser()?.userType;
  if (!userType) return false;
  return SUPER_USER_TYPES.has(String(userType).trim().toLowerCase());
}
