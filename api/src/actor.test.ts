import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { actorId } from "./actor";

describe("actorId", () => {
  it("is stable for the same identifier and never contains it", async () => {
    const first = await actorId(env, "ip", "203.0.113.7");
    const second = await actorId(env, "ip", "203.0.113.7");
    expect(first).toBe(second);
    expect(first.startsWith("ip:")).toBe(true);
    expect(first).not.toContain("203.0.113.7");
  });

  it("buckets IPv6 addresses by /64", async () => {
    const a = await actorId(env, "ip", "2001:db8:12:34:aaaa:bbbb:cccc:dddd");
    const b = await actorId(env, "ip", "2001:db8:12:34:1:2:3:4");
    const c = await actorId(env, "ip", "2001:db8:12:35:aaaa:bbbb:cccc:dddd");
    const compressed = await actorId(env, "ip", "2001:db8:12:34::9");
    expect(a).toBe(b);
    expect(a).toBe(compressed);
    expect(a).not.toBe(c);
  });

  it("treats v4-mapped addresses as their v4 form", async () => {
    const mapped = await actorId(env, "ip", "::ffff:203.0.113.7");
    const plain = await actorId(env, "ip", "203.0.113.7");
    expect(mapped).toBe(plain);
  });

  it("hashes unparseable input as-is instead of failing", async () => {
    const weird = await actorId(env, "ip", "not-an-ip");
    expect(weird.startsWith("ip:")).toBe(true);
  });

  it("separates kinds and identifiers", async () => {
    const ip = await actorId(env, "ip", "42");
    const tg = await actorId(env, "tg", "42");
    const other = await actorId(env, "ip", "43");
    expect(ip).not.toBe(tg);
    expect(ip).not.toBe(other);
  });
});
