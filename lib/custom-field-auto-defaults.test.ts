import { describe, expect, it } from "vitest";
import {
  AUTO_CURRENT_DATE,
  formatDateYyyyMmDd,
  isAutoCurrentSentinel,
  resolveInitialValueFromDefinition,
} from "./custom-field-auto-defaults";

describe("isAutoCurrentSentinel", () => {
  it("detects known sentinels", () => {
    expect(isAutoCurrentSentinel(AUTO_CURRENT_DATE)).toBe(true);
    expect(isAutoCurrentSentinel("")).toBe(false);
  });
});

describe("resolveInitialValueFromDefinition", () => {
  it("returns empty for date sentinel when not applying auto (edit flow)", () => {
    expect(
      resolveInitialValueFromDefinition(
        { field_type: "date", default_value: AUTO_CURRENT_DATE },
        false
      )
    ).toBe("");
  });

  it("returns ISO date when applying auto for date sentinel", () => {
    const v = resolveInitialValueFromDefinition(
      { field_type: "date", default_value: AUTO_CURRENT_DATE },
      true
    );
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v).toBe(formatDateYyyyMmDd(new Date()));
  });
});
