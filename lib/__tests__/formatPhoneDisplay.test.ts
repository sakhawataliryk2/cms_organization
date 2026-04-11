import { describe, it, expect } from "vitest";
import { formatPhoneForDisplay, isPhoneLikeValue } from "../formatPhoneDisplay";

describe("formatPhoneForDisplay", () => {
  it("formats US 10-digit", () => {
    expect(formatPhoneForDisplay("6692192599")).toBe("(669) 219-2599");
  });

  it("formats NANP +1 11-digit", () => {
    expect(formatPhoneForDisplay("+16692192599")).toBe("+1 (669) 219-2599");
  });

  it("formats Pakistan-style +92", () => {
    expect(formatPhoneForDisplay("+923444803673")).toBe("+92 344 480 3673");
  });

  it("preserves extension", () => {
    expect(formatPhoneForDisplay("+1 (669) 219-2599 ext 9")).toMatch(/ext\. 9$/);
  });
});

describe("isPhoneLikeValue", () => {
  it("detects international + string", () => {
    expect(isPhoneLikeValue("+923444803673", {})).toBe(true);
  });

  it("rejects pure dates", () => {
    expect(isPhoneLikeValue("04/11/2026", {})).toBe(false);
  });
});
