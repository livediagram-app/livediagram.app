import { expandIpv6 } from '@liveworkspace/sites/network';

// The caller's IP for rate-limit keying — Cloudflare's `CF-Connecting-IP`, the
// trusted client IP at the edge. Falls back to a fixed bucket when the header is
// absent (local dev / non-CF) so every no-IP caller shares ONE limiter key
// instead of bypassing the limit. Centralised so the exact header name lives in
// one place: a typo here would silently disable a rate limiter.
export function clientIp(request: Request, fallback = 'anonymous'): string {
  return request.headers.get('CF-Connecting-IP') ?? fallback;
}

// The per-caller key for an IP rate limiter. IPv4 keeps the exact address
// (one address is often a whole household or office behind NAT, so widening
// would starve neighbours). IPv6 keys on the /64: a single host is routinely
// handed a whole /64, so keying on the exact address let one caller rotate
// through billions of fresh buckets.
export function clientRateKey(request: Request, fallback = 'anonymous'): string {
  const ip = clientIp(request, fallback);
  const hextets = expandIpv6(ip);
  return hextets ? `${hextets.slice(0, 4).join(':')}::/64` : ip;
}

// The network a caller comes from, for the anonymous rate limiters (forms, invite declines): the caller's address
// range rather than the exact address, so one person cannot pass for many by rotating addresses inside what they
// hold (an IPv6 user typically holds a whole /56 or /64, and an IPv4 one can often hop within a /24). IPv4 keeps its
// /24, IPv6 its /56. Anything unparseable is its own network.
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;

export function clientNetwork(ip: string): string {
  const v4 = IPV4.exec(ip.trim());
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  const hextets = expandIpv6(ip.trim());
  if (!hextets) return ip.trim();
  // /56: the first three hextets and the high byte of the fourth.
  return `${hextets.slice(0, 3).join(':')}:${hextets[3]!.slice(0, 2)}00::/56`;
}
