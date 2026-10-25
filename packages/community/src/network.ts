// The network a request comes from (liveworkspace/docs/community.md "Public routes"): the caller's address range
// rather than the exact address, so one person cannot pass for many by rotating addresses inside what they hold (an
// IPv6 user typically holds a whole /56 or /64, and an IPv4 one can often hop within a /24). IPv4 keeps its /24, IPv6 its
// /56. Anything unparseable is its own network. The Community service counts likes, copies and reports per network;
// the apps key their per-network rate limits on it.

import { expandIpv6 } from '@liveworkspace/sites/network';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;

export function communityNetwork(ip: string): string {
  const v4 = IPV4.exec(ip.trim());
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  const hextets = expandIpv6(ip.trim());
  if (!hextets) return ip.trim();
  // /56: the first three hextets and the high byte of the fourth.
  return `${hextets.slice(0, 3).join(':')}:${hextets[3]!.slice(0, 2)}00::/56`;
}
