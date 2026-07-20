import ipaddr from "ipaddr.js";

const BUCKET_MS = 12 * 60 * 60 * 1000;

let ephemeralKey: string | null = null;
const cryptoKeys = new Map<string, Promise<CryptoKey>>();

function keyMaterial(env: Env): string {
  if (env.ACTOR_HASH_KEY) return env.ACTOR_HASH_KEY;
  ephemeralKey ??= [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return ephemeralKey;
}

function hmacKey(material: string): Promise<CryptoKey> {
  let key = cryptoKeys.get(material);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(material),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    cryptoKeys.set(material, key);
  }
  return key;
}

/**
 * Pseudonymous actor identifier: keyed hash of the raw identifier plus a
 * 12h time bucket, so identifiers are stable within a budget window and
 * unlinkable across windows. Raw IPs and user ids never leave the request.
 */
function ipNetwork(ip: string): string {
  let parsed: ReturnType<typeof ipaddr.parse>;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return ip;
  }

  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().toString();
    return v6.parts
      .slice(0, 4)
      .map((part) => part.toString(16))
      .join(":");
  }
  return parsed.toString();
}

export async function actorId(
  env: Env,
  kind: "ip" | "tg",
  value: string | number,
): Promise<string> {
  if (kind === "ip") value = ipNetwork(String(value));
  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const key = await hmacKey(keyMaterial(env));
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${kind}|${value}|${bucket}`),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${kind}:${hex}`;
}
