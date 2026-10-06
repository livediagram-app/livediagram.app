// The network a Community like, copy or report comes from (docs/specs/025-community/community.md "Likes", "Reports
// and moderation"; blueprint §7): the caller's address range rather than the exact address, so one person cannot
// pass for many by rotating addresses inside what they hold (an IPv6 user typically holds a whole /56 or /64, and an
// IPv4 one can often hop within a /24). IPv4 keeps its /24, IPv6 its /56. Anything unparseable is its own network.
// Only ever stored as a one-way hash salted with the post id (communityNetworkHash), so it cannot be compared across
// posts.

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;

export function communityNetwork(ip: string): string {
  const v4 = IPV4.exec(ip.trim());
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  const hextets = expandIpv6(ip.trim());
  if (!hextets) return ip.trim();
  // /56: the first three hextets and the high byte of the fourth.
  return `${hextets.slice(0, 3).join(':')}:${hextets[3]!.slice(0, 2)}00::/56`;
}

// The eight four-digit hextets of an IPv6 address (an embedded IPv4 tail counts as two), or null when it is not one.
export function expandIpv6(ip: string): string[] | null {
  if (!ip.includes(':')) return null;
  let address = ip.toLowerCase().split('%')[0]!;
  const tail = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number) as [number, number, number, number];
    const hex = (hi: number, lo: number) => ((hi << 8) | lo).toString(16);
    address = `${address.slice(0, tail.index)}${hex(a, b)}:${hex(c, d)}`;
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (!all.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return all.map((h) => h.padStart(4, '0'));
}
