/**
 * Sentinel values stored in custom field definition `default_value`.
 * Resolved to real date/time/user id only when creating a new record (add form),
 * not when editing an existing record.
 */
export const AUTO_CURRENT_DATE = "__cms_auto_current_date__";
export const AUTO_CURRENT_DATETIME = "__cms_auto_current_datetime__";
export const AUTO_CURRENT_OWNER_USER_ID = "__cms_auto_current_owner_user_id__";

const AUTO_SENTINELS = new Set([
  AUTO_CURRENT_DATE,
  AUTO_CURRENT_DATETIME,
  AUTO_CURRENT_OWNER_USER_ID,
]);

export function isAutoCurrentSentinel(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim();
  return AUTO_SENTINELS.has(v);
}

export function formatDateYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Value suitable for `<input type="datetime-local">` and API. */
export function formatDatetimeLocalFromDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Read current user id from `user` cookie or JWT `token` (client-only). */
export function getCurrentUserIdFromClient(): string {
  if (typeof document === "undefined" || !document.cookie) return "";
  try {
    const cookieString = document.cookie;
    const cookieMap: Record<string, string> = {};
    cookieString.split(";").forEach((part) => {
      const [k, v] = part.split("=").map((s) => s.trim());
      if (!k) return;
      cookieMap[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    });
    const userCookie = cookieMap["user"];
    if (userCookie) {
      const userData = JSON.parse(userCookie) as { id?: string | number };
      if (userData?.id != null) return String(userData.id);
    }
    if (cookieMap["token"]) {
      const payloadB64 = cookieMap["token"].split(".")[1];
      if (payloadB64) {
        const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
        const decoded = JSON.parse(json) as {
          userId?: string | number;
          id?: string | number;
        };
        const uid = decoded?.userId ?? decoded?.id;
        if (uid != null) return String(uid);
      }
    }
    return (
      cookieMap["owner_id"] ||
      cookieMap["ownerId"] ||
      cookieMap["user_id"] ||
      cookieMap["userId"] ||
      ""
    );
  } catch {
    return "";
  }
}

export type CustomFieldLike = {
  field_type?: string;
  field_name?: string;
  default_value?: string | null;
  lookup_type?: string | null;
};

/**
 * Initial value for a field from its definition. When `applyAutoCurrentDefaults` is false
 * (edit existing record), auto sentinels yield "" until API-loaded values replace them.
 */
export function resolveInitialValueFromDefinition(
  fld: CustomFieldLike,
  applyAutoCurrentDefaults: boolean
): string {
  const raw = String(fld.default_value ?? "").trim();

  if (!applyAutoCurrentDefaults) {
    if (isAutoCurrentSentinel(raw)) return "";
    return raw;
  }

  if (fld.field_type === "date" && raw === AUTO_CURRENT_DATE) {
    return formatDateYyyyMmDd(new Date());
  }
  if (fld.field_type === "datetime" && raw === AUTO_CURRENT_DATETIME) {
    return formatDatetimeLocalFromDate(new Date());
  }
  const isOwnerLookup =
    fld.field_type === "lookup" &&
    String(fld.lookup_type ?? "").trim().toLowerCase() === "owner";
  if (isOwnerLookup && raw === AUTO_CURRENT_OWNER_USER_ID) {
    return getCurrentUserIdFromClient() || "";
  }

  return raw;
}

/** If a sentinel leaked into submitted values, resolve it (create flows only). */
export function resolveSentinelForSubmission(
  field: CustomFieldLike,
  value: unknown,
  applyAutoCurrentDefaults: boolean
): unknown {
  if (!applyAutoCurrentDefaults) return value;
  const s = String(value ?? "").trim();
  if (field.field_type === "date" && s === AUTO_CURRENT_DATE) {
    return formatDateYyyyMmDd(new Date());
  }
  if (field.field_type === "datetime" && s === AUTO_CURRENT_DATETIME) {
    return formatDatetimeLocalFromDate(new Date());
  }
  const isOwnerLookup =
    field.field_type === "lookup" &&
    String(field.lookup_type ?? "").trim().toLowerCase() === "owner";
  if (isOwnerLookup && s === AUTO_CURRENT_OWNER_USER_ID) {
    return getCurrentUserIdFromClient() || "";
  }
  return value;
}
