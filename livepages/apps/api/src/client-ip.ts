import { expandIpv6 } from './community-network';

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
