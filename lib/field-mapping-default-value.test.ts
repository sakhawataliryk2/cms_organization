import { describe, expect, it } from "vitest";
import {
  AUTO_CURRENT_DATE,
  AUTO_CURRENT_DATETIME,
  AUTO_CURRENT_OWNER_USER_ID,
} from "./custom-field-auto-defaults";
import {
  fromDatetimeLocalInputValue,
  getDefaultValueHelperText,
  parseMultiselectDefault,
  toDateInputValue,
  toDatetimeLocalInputValue,
  validateFieldMappingDefaultValue,
} from "./field-mapping-default-value";

describe("toDateInputValue", () => {
  it("returns empty for blank", () => {
    expect(toDateInputValue("")).toBe("");
  });
  it("passes through ISO yyyy-mm-dd", () => {
    expect(toDateInputValue("2024-06-15")).toBe("2024-06-15");
  });
  it("converts m/d/yyyy", () => {
    expect(toDateInputValue("6/5/2024")).toBe("2024-06-05");
  });
});

describe("toDatetimeLocalInputValue / fromDatetimeLocalInputValue", () => {
  it("slices local-shaped string", () => {
    expect(toDatetimeLocalInputValue("2024-01-02T14:30:00")).toBe("2024-01-02T14:30");
  });
  it("round-trips fromDatetimeLocalInputValue", () => {
    expect(fromDatetimeLocalInputValue("2024-03-10T08:00")).toBe("2024-03-10T08:00");
  });
});

describe("parseMultiselectDefault", () => {
  it("splits and trims comma list", () => {
    expect(parseMultiselectDefault(" a , b ,c ")).toEqual(["a", "b", "c"]);
  });
});

describe("getDefaultValueHelperText", () => {
  it("returns specific copy for date", () => {
    expect(getDefaultValueHelperText("date")).toContain("YYYY-MM-DD");
  });
  it("returns specific copy for lookup", () => {
    expect(getDefaultValueHelperText("lookup")).toContain("lookup");
  });
});

describe("validateFieldMappingDefaultValue", () => {
  it("allows empty value for any type", () => {
    const r = validateFieldMappingDefaultValue({
      fieldType: "date",
      value: "  ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("");
  });

  it("accepts valid ISO date", () => {
    const r = validateFieldMappingDefaultValue({
      fieldType: "date",
      value: "2025-12-31",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("2025-12-31");
  });

  it("rejects invalid date", () => {
    const r = validateFieldMappingDefaultValue({
      fieldType: "date",
      value: "not-a-date",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts datetime-local shaped value", () => {
    const r = validateFieldMappingDefaultValue({
      fieldType: "datetime",
      value: "2025-01-01T12:30",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("2025-01-01T12:30");
  });

  it("accepts number and currency", () => {
    expect(
      validateFieldMappingDefaultValue({ fieldType: "number", value: "-3.5" }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({ fieldType: "currency", value: "$12.50" }).ok
    ).toBe(true);
  });

  it("rejects bad number", () => {
    const r = validateFieldMappingDefaultValue({
      fieldType: "number",
      value: "12abc",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects negative percentage", () => {
    const r = validateFieldMappingDefaultValue({
      fieldType: "percentage",
      value: "-1",
    });
    expect(r.ok).toBe(false);
  });

  it("requires select default in options", () => {
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "select",
        value: "A",
        options: ["A", "B"],
      }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "select",
        value: "Z",
        options: ["A", "B"],
      }).ok
    ).toBe(false);
  });

  it("validates multiselect tokens", () => {
    const ok = validateFieldMappingDefaultValue({
      fieldType: "multiselect",
      value: "A,B",
      options: ["A", "B"],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.normalized).toBe("A,B");
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "multicheckbox",
        value: "A,X",
        options: ["A", "B"],
      }).ok
    ).toBe(false);
  });

  it("validates checkbox true/false only", () => {
    expect(
      validateFieldMappingDefaultValue({ fieldType: "checkbox", value: "true" })
        .ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({ fieldType: "checkbox", value: "yes" }).ok
    ).toBe(false);
  });

  it("validates lookup IDs", () => {
    expect(
      validateFieldMappingDefaultValue({ fieldType: "lookup", value: "42" }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({ fieldType: "lookup", value: "x" }).ok
    ).toBe(false);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "multiselect_lookup",
        value: "1, 2",
      }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "multiselect_lookup",
        value: "1,a",
      }).ok
    ).toBe(false);
  });

  it("validates email and url", () => {
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "email",
        value: "a@b.co",
      }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({ fieldType: "email", value: "bad" }).ok
    ).toBe(false);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "url",
        value: "https://example.com",
      }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "link",
        value: "ftp://x",
      }).ok
    ).toBe(false);
  });

  it("rejects file and composite defaults", () => {
    expect(
      validateFieldMappingDefaultValue({ fieldType: "file", value: "x" }).ok
    ).toBe(false);
    expect(
      validateFieldMappingDefaultValue({ fieldType: "composite", value: "x" }).ok
    ).toBe(false);
  });

  it("fails select when options list empty but value set", () => {
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "select",
        value: "A",
        options: [],
      }).ok
    ).toBe(false);
  });

  it("accepts auto-current sentinels for date, datetime, and owner lookup", () => {
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "date",
        value: AUTO_CURRENT_DATE,
      }).ok
    ).toBe(true);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "datetime",
        value: AUTO_CURRENT_DATETIME,
      }).ok
    ).toBe(true);
    const ownerOk = validateFieldMappingDefaultValue({
      fieldType: "lookup",
      value: AUTO_CURRENT_OWNER_USER_ID,
      lookupType: "owner",
    });
    expect(ownerOk.ok).toBe(true);
    if (ownerOk.ok) expect(ownerOk.normalized).toBe(AUTO_CURRENT_OWNER_USER_ID);
    expect(
      validateFieldMappingDefaultValue({
        fieldType: "lookup",
        value: AUTO_CURRENT_OWNER_USER_ID,
        lookupType: "jobs",
      }).ok
    ).toBe(false);
  });
});
