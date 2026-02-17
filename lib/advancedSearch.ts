import type { AdvancedSearchCriterion } from "@/components/AdvancedSearchPanel";

/**
 * Generic matcher used by list pages for Advanced Search.
 * Given a raw value (from the row), the admin `fieldType`, and the criterion,
 * returns true if the value matches the criterion.
 */
export function matchesAdvancedValue(
  raw: unknown,
  fieldType: string | undefined,
  c: AdvancedSearchCriterion
): boolean {
  const type = String(fieldType || "").toLowerCase();
  const isDate = /date|datetime/.test(type);
  const isTime = type === "time";
  const isNumber =
    type === "number" ||
    type === "currency" ||
    type === "percentage" ||
    type === "percent";

  const isEmptyValue =
    raw === undefined ||
    raw === null ||
    String(raw).trim() === "" ||
    String(raw).toLowerCase() === "n/a";

  // Empty / exists / boolean-no-value operators
  if (c.operator === "is_empty") return isEmptyValue;
  if (c.operator === "is_not_empty") return !isEmptyValue;

  if (c.operator === "exists") return !isEmptyValue;
  if (c.operator === "not_exists") return isEmptyValue;

  // Checkbox/boolean style
  if (c.operator === "is_checked" || c.operator === "is_not_checked") {
    const strRaw = String(raw ?? "").trim().toLowerCase();
    const truthy =
      strRaw === "true" ||
      strRaw === "yes" ||
      strRaw === "1" ||
      strRaw === "checked";
    return c.operator === "is_checked" ? truthy : !truthy;
  }

  // Date / datetime
  if (isDate) {
    const orgDate = !raw || String(raw).toLowerCase() === "n/a"
      ? null
      : new Date(String(raw));
    if (!orgDate || isNaN(orgDate.getTime())) return false;

    if (c.operator === "before" && c.value) {
      const target = new Date(c.value);
      return !isNaN(target.getTime()) && orgDate.getTime() < target.getTime();
    }
    if (c.operator === "after" && c.value) {
      const target = new Date(c.value);
      return !isNaN(target.getTime()) && orgDate.getTime() > target.getTime();
    }
    if ((c.operator === "equals" || c.operator === "on") && c.value) {
      const target = new Date(c.value);
      if (isNaN(target.getTime())) return false;
      const o = orgDate.toISOString().slice(0, 10);
      const t = target.toISOString().slice(0, 10);
      return o === t;
    }
    if (
      (c.operator === "between" || c.operator === "is_between") &&
      c.valueFrom &&
      c.valueTo
    ) {
      const from = new Date(c.valueFrom);
      const to = new Date(c.valueTo);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
      const ts = orgDate.getTime();
      return ts >= from.getTime() && ts <= to.getTime();
    }
    if (c.operator === "within" && c.value) {
      const days = Number(c.value);
      if (Number.isNaN(days) || days < 0) return false;
      const now = Date.now();
      const from = now - days * 24 * 60 * 60 * 1000;
      const ts = orgDate.getTime();
      return ts >= from && ts <= now;
    }
    return false;
  }

  // Time
  if (isTime) {
    const orgTime = String(raw ?? "").trim();
    if (!orgTime || orgTime.toLowerCase() === "n/a") return false;
    const v = (c.value ?? "").trim();
    if (c.operator === "equals") return orgTime === v;
    if (c.operator === "before") return v ? orgTime < v : false;
    if (c.operator === "after") return v ? orgTime > v : false;
    if (c.operator === "between" && c.valueFrom && c.valueTo) {
      const a = c.valueFrom.trim();
      const b = c.valueTo.trim();
      return orgTime >= a && orgTime <= b;
    }
    return false;
  }

  // Numbers (number / currency / percentage / percent)
  if (isNumber) {
    const n =
      typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
    if (Number.isNaN(n)) return false;
    const v = Number(c.value);
    const a = Number(c.valueFrom);
    const b = Number(c.valueTo);
    if (c.operator === "equals") return !Number.isNaN(v) && n === v;
    if (c.operator === "not_equals") return !Number.isNaN(v) && n !== v;
    if (c.operator === "gt") return !Number.isNaN(v) && n > v;
    if (c.operator === "gte") return !Number.isNaN(v) && n >= v;
    if (c.operator === "lt") return !Number.isNaN(v) && n < v;
    if (c.operator === "lte") return !Number.isNaN(v) && n <= v;
    if (c.operator === "between") {
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return n >= a && n <= b;
    }
    return false;
  }

  // String-like (text, email, phone, url, link, lookup, select, etc.)
  const str = String(raw ?? "").toLowerCase();
  if (str === "n/a" || !str) {
    if (c.operator === "exclude") return true;
    return false;
  }
  const v = String(c.value ?? "").trim().toLowerCase();
  const words = v
    .split(/[\s,]+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

  if (c.operator === "equals") return v !== "" ? str === v : true;
  if (c.operator === "not_equals") return v !== "" ? str !== v : true;
  if (c.operator === "starts_with") return v !== "" ? str.startsWith(v) : true;
  if (c.operator === "ends_with") return v !== "" ? str.endsWith(v) : true;
  if (c.operator === "contains") return v !== "" ? str.includes(v) : true;
  if (c.operator === "not_contains") return v !== "" ? !str.includes(v) : true;

  // Email-specific: domain equals
  if (type === "email" && c.operator === "domain_equals" && v) {
    const atIdx = str.lastIndexOf("@");
    if (atIdx === -1) return false;
    const domain = str.slice(atIdx + 1);
    return domain === v;
  }

  // Phone-specific: area code
  if (
    type === "phone" &&
    (c.operator === "area_code_is" || c.operator === "area_code_is_not") &&
    v
  ) {
    const digits = str.replace(/\D/g, "");
    const area = digits.slice(0, 3);
    if (!area) return false;
    return c.operator === "area_code_is" ? area === v : area !== v;
  }

  // Multi-select style
  if (c.operator === "any_of") {
    const list = String(c.value ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (list.length === 0) return true;
    return list.includes(str);
  }
  if (c.operator === "none_of") {
    const list = String(c.value ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (list.length === 0) return true;
    return !list.includes(str);
  }

  if (words.length === 0) return true;
  if (c.operator === "include_any") return words.some((w) => str.includes(w));
  if (c.operator === "include_all") return words.every((w) => str.includes(w));
  if (c.operator === "exclude") return !words.some((w) => str.includes(w));

  // Fallback: consider it a match
  return true;
}

