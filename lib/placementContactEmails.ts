import { getCustomFieldLabel } from "./getCustomFieldLabel";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const HM_EMAIL_FIELD_NAME = "Field_7";

function extractLookupId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return s;
    return null;
  }
  if (Array.isArray(raw)) return extractLookupId(raw[0]);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return extractLookupId(obj.id ?? obj.value ?? obj.record_id ?? obj.recordId);
  }
  return null;
}

function parseCustomFields(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function extractEmails(value: unknown, out: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (EMAIL_REGEX.test(trimmed)) out.add(trimmed.toLowerCase());
    const matches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
    if (matches) {
      matches.forEach((m) => {
        const t = m.trim();
        if (EMAIL_REGEX.test(t)) out.add(t.toLowerCase());
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractEmails(item, out));
    return;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      extractEmails(item, out)
    );
  }
}

export function getPlacementEntityType(pl: any): string {
  const t = String(pl?.placementType || pl?.placement_type || "").toLowerCase();
  if (t.includes("direct")) return "placements-direct-hire";
  if (t.includes("executive")) return "placements-executive-search";
  return "placements";
}

/**
 * Resolve the email(s) of a Hiring Manager linked to a placement as a custom-field
 * lookup (e.g. billing contact or time card approver).
 *
 * The HM id lives in the placement's custom_fields under the resolved label of
 * `linkFieldName` (e.g. "Field_3" / "Field_20"). The HM's email lives in the HM's
 * custom_fields under the resolved label of "Field_7" (Primary Email), so the label
 * is resolved first and the value is read by that label.
 */
export async function resolvePlacementHmEmails(params: {
  placement: any;
  linkFieldName: string;
  headers?: Record<string, string>;
}): Promise<string[]> {
  const { placement, linkFieldName, headers } = params;
  const emailSet = new Set<string>();

  const placementCustom = parseCustomFields(
    placement?.customFields ?? placement?.custom_fields
  );
  const entityType = getPlacementEntityType(placement);
  const linkLabel = await getCustomFieldLabel(entityType, linkFieldName);
  const hmId = linkLabel ? extractLookupId(placementCustom[linkLabel]) : null;

  if (hmId) {
    try {
      const res = await fetch(`/api/hiring-managers/${hmId}`, { headers });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const hm = data?.hiringManager ?? data?.hiring_manager ?? data ?? null;
        if (hm) {
          const hmCustom = parseCustomFields(hm.custom_fields ?? hm.customFields);
          const emailLabel = await getCustomFieldLabel(
            "hiring-managers",
            HM_EMAIL_FIELD_NAME
          );
          const rawEmail =
            (emailLabel && emailLabel !== HM_EMAIL_FIELD_NAME
              ? hmCustom[emailLabel]
              : undefined) ??
            hmCustom[HM_EMAIL_FIELD_NAME] ??
            hm.email ??
            hm.primary_email ??
            hm.primaryEmail;
          extractEmails(rawEmail, emailSet);
        }
      }
    } catch {
      // Ignore - callers fall back to other email sources.
    }
  }

  return Array.from(emailSet);
}
