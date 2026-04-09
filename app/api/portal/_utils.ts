import { cookies } from "next/headers";

export function getApiBaseUrl() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

export async function getPortalToken() {
  const cookieStore = await cookies();
  return (
    cookieStore.get("portal_token")?.value ||
    cookieStore.get("jobseeker_token")?.value ||
    cookieStore.get("hiring_manager_token")?.value ||
    ""
  );
}

