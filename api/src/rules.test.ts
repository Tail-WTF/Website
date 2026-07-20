import { describe, expect, it } from "vitest";
import { rules } from "./rules";
import { sanitizeURL } from "./sanitizer";

describe("bundled rules", () => {
  it("contains sanitize rules for known domains", () => {
    expect(rules["www.amazon.com"]?.sanitize?.length).toBeGreaterThan(0);
    expect(rules["b23.tv"]?.expand?.length).toBeGreaterThan(0);
  });

  it("keeps only the video id and timestamp for YouTube watch URLs", async () => {
    const result = await sanitizeURL(
      "https://www.youtube.com/watch?v=abc12345xyz&si=share123&list=PLx",
      rules,
    );
    expect(result.sanitized).toBe(
      "https://www.youtube.com/watch?v=abc12345xyz",
    );
  });

  it("keeps the required id param for Google Play app pages", async () => {
    const result = await sanitizeURL(
      "https://play.google.com/store/apps/details?id=com.example.app&referrer=utm_source%3Dx&hl=en",
      rules,
    );
    expect(result.sanitized).toBe(
      "https://play.google.com/store/apps/details?id=com.example.app",
    );
  });

  it("keeps the item id for Taobao item pages", async () => {
    const result = await sanitizeURL(
      "https://item.taobao.com/item.htm?id=12345&spm=a21n57.1.item.1&pvid=xyz",
      rules,
    );
    expect(result.sanitized).toBe("https://item.taobao.com/item.htm?id=12345");
  });

  it("drops all params from Google Maps place URLs but keeps the path", async () => {
    const result = await sanitizeURL(
      "https://www.google.com/maps/place/Some+Landmark/@48.8583701,2.2919064,17z/?entry=ttu&g_ep=abc",
      rules,
    );
    expect(result.sanitized).toBe(
      "https://www.google.com/maps/place/Some+Landmark/@48.8583701,2.2919064,17z/",
    );
  });

  it("sanitizes an Amazon product URL down to its path", async () => {
    const result = await sanitizeURL(
      "https://www.amazon.com/Some-Product/dp/B0ABC123/?tag=aff-20&ref_=xyz",
      rules,
    );
    expect(result.sanitized).toBe(
      "https://www.amazon.com/Some-Product/dp/B0ABC123",
    );
    expect(result.method).toBe("rule");
  });
});
