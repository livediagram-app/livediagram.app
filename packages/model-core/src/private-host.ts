// The one rule for which hosts a server may never request for someone (SSRF): internal names and private addresses
// (liveworkspace/docs/specs/002-architecture/architecture.md "Fetching a URL someone gave"). Shared by the webhooks'
// and live status's URL check (public-https-url.ts), the image upload by URL (@liveworkspace/api-kit/public-fetch)
// and every product's link unfurl (@liveworkspace/api-kit/unfurl), so a host one refuses no other fetches. Hosts are
// read left to right, one character at a time, never by a regex that could backtrack. Pure and synchronous.

// Names that only mean something inside a network.
export const INTERNAL_HOST_SUFFIXES: readonly string[] = [
  '.local',
  '.localhost',
  '.internal',
  '.lan',
  '.home.arpa',
  '.intranet',
];

// [first address, prefix length] of each IPv4 range no server-side fetch may reach: this network, private, carrier NAT,
// loopback, link-local (cloud metadata's 169.254.169.254 among it), IETF protocol assignments, the documentation
// ranges, the old 6to4 relay, benchmarking, multicast and reserved.
const V4_BLOCKED: readonly (readonly [number, number])[] = (
  [
    [[0, 0, 0, 0], 8],
    [[10, 0, 0, 0], 8],
    [[100, 64, 0, 0], 10],
    [[127, 0, 0, 0], 8],
    [[169, 254, 0, 0], 16],
    [[172, 16, 0, 0], 12],
    [[192, 0, 0, 0], 24],
    [[192, 0, 2, 0], 24],
    [[192, 88, 99, 0], 24],
    [[192, 168, 0, 0], 16],
    [[198, 18, 0, 0], 15],
    [[198, 51, 100, 0], 24],
    [[203, 0, 113, 0], 24],
    [[224, 0, 0, 0], 4],
    [[240, 0, 0, 0], 4],
  ] as const
).map(([[a, b, c, d], bits]) => [((a * 256 + b) * 256 + c) * 256 + d, 2 ** (32 - bits)] as const);

const DOT = 46;
const COLON = 58;
const ZERO = 48;
const NINE = 57;

const isDigit = (code: number) => code >= ZERO && code <= NINE;

// A hex digit's value, or -1.
function hexValue(code: number): number {
  if (isDigit(code)) return code - ZERO;
  const lower = code | 0x20;
  return lower >= 97 && lower <= 102 ? lower - 87 : -1;
}

/** An IPv4 address as a number: exactly four decimal parts of 0 to 255, no sign, no leading zero. Null otherwise. */
export function parseIpv4(text: string): number | null {
  if (text.length > 15) return null;
  let value = 0;
  let part = 0;
  let digits = 0;
  let parts = 0;
  for (let i = 0; i <= text.length; i += 1) {
    const code = i === text.length ? DOT : text.charCodeAt(i);
    if (code === DOT) {
      if (digits === 0 || part > 255) return null;
      value = value * 256 + part;
      parts += 1;
      part = 0;
      digits = 0;
    } else if (isDigit(code)) {
      // A leading zero reads as octal to some resolvers: not an address this rule will judge.
      if (digits > 0 && part === 0) return null;
      part = part * 10 + code - ZERO;
      digits += 1;
    } else {
      return null;
    }
  }
  return parts === 4 ? value : null;
}

/** An IPv6 address's eight 16-bit words: hextets of one to four hex digits, at most one `::`, an optional IPv4 tail.
 *  No brackets or zone. Null otherwise. */
export function parseIpv6(text: string): number[] | null {
  // Eight hextets and seven colons is 39; six hextets and a dotted IPv4 tail is 45.
  if (text.length < 2 || text.length > 45) return null;
  const head: number[] = [];
  const tail: number[] = [];
  let words = head;
  let gap = false;
  let i = 0;
  if (text.charCodeAt(0) === COLON) {
    if (text.charCodeAt(1) !== COLON) return null;
    gap = true;
    words = tail;
    i = 2;
  }
  while (i < text.length) {
    let j = i;
    let word = 0;
    for (
      let digit = hexValue(text.charCodeAt(j));
      digit >= 0;
      digit = hexValue(text.charCodeAt(j))
    ) {
      word = word * 16 + digit;
      j += 1;
    }
    if (text.charCodeAt(j) === DOT) {
      // The last 32 bits written as IPv4 (`::ffff:127.0.0.1`).
      const v4 = parseIpv4(text.slice(i));
      if (v4 === null) return null;
      words.push(Math.floor(v4 / 65536), v4 % 65536);
      break;
    }
    if (j === i || j - i > 4) return null;
    words.push(word);
    if (j === text.length) break;
    if (text.charCodeAt(j) !== COLON) return null;
    if (text.charCodeAt(j + 1) === COLON) {
      if (gap) return null;
      gap = true;
      words = tail;
      i = j + 2;
    } else {
      i = j + 1;
      // A single colon must lead into another hextet.
      if (i === text.length) return null;
    }
  }
  const count = head.length + tail.length;
  if (gap ? count > 7 : count !== 8) return null;
  return [...head, ...Array<number>(8 - count).fill(0), ...tail];
}

const v4Blocked = (n: number) => V4_BLOCKED.some(([start, size]) => n >= start && n < start + size);

function v6Blocked(words: readonly number[]): boolean {
  const [a, b] = words as [number, number];
  const zeroes = (from: number, to: number) => words.slice(from, to).every((w) => w === 0);
  // An IPv4 address carried in IPv6 (mapped ::ffff:0:0/96, the NAT64 prefix 64:ff9b::/96): judged as that address.
  const mapped = zeroes(0, 5) && words[5] === 0xffff;
  const nat64 = a === 0x64 && b === 0xff9b && zeroes(2, 6);
  if (mapped || nat64) return v4Blocked(words[6]! * 65536 + words[7]!);
  // Unspecified, loopback and IPv4-compatible (::/96).
  if (zeroes(0, 6)) return true;
  // Unique local fc00::/7, link-local fe80::/10, site-local fec0::/10, multicast ff00::/8.
  if ((a & 0xfe00) === 0xfc00 || (a & 0xffc0) === 0xfe80 || (a & 0xffc0) === 0xfec0) return true;
  if ((a & 0xff00) === 0xff00) return true;
  // Documentation 2001:db8::/32, discard 100::/64, and 6to4 2002::/16 (whose embedded IPv4 could be anything).
  if ((a === 0x2001 && b === 0x0db8) || a === 0x2002) return true;
  return a === 0x0100 && zeroes(1, 4);
}

/** Whether an IPv4 or IPv6 address is one no server-side fetch may reach. Anything that isn't an address counts as one. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = parseIpv4(ip);
  if (v4 !== null) return v4Blocked(v4);
  const words = parseIpv6(ip);
  return words === null || v6Blocked(words);
}

// A label a URL would have read as a number: decimal, or hex after `0x`. WHATWG URL turns a host ending in one into
// dotted decimal or refuses it, so a name ending in one never reached here from an honest URL.
function isNumericLabel(label: string): boolean {
  const hex = label.startsWith('0x');
  for (let i = hex ? 2 : 0; i < label.length; i += 1) {
    const code = label.charCodeAt(i);
    if (hex ? hexValue(code) < 0 : !isDigit(code)) return false;
  }
  return true;
}

/** Whether a lower-cased host NAME only means something inside a network: empty, a single label (`localhost`,
 *  `metadata`), under an internal suffix (`metadata.google.internal`), or ending in a numeric label. */
export function isInternalHostName(name: string): boolean {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return true;
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  return isNumericLabel(name.slice(lastDot + 1));
}

export type HostClass = {
  /** Lower-cased, IPv6 brackets and one trailing dot removed. */
  host: string;
  /** `address` for an IPv4 or IPv6 literal (or a host with a colon or bracket that fails to be one). */
  kind: 'address' | 'name';
  /** Never to be requested: a private address, an internal name, or something that is neither address nor name. */
  private: boolean;
};

/** What a URL's hostname is, and whether a server may never request it. */
export function classifyHost(hostname: string): HostClass {
  let host = hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  const bracketed = host.startsWith('[') && host.endsWith(']');
  if (bracketed) host = host.slice(1, -1);
  const v4 = bracketed ? null : parseIpv4(host);
  if (v4 !== null) return { host, kind: 'address', private: v4Blocked(v4) };
  if (bracketed || host.includes(':') || host.includes('[') || host.includes(']')) {
    const words = parseIpv6(host);
    return { host, kind: 'address', private: words === null || v6Blocked(words) };
  }
  return { host, kind: 'name', private: isInternalHostName(host) };
}
