// Anthropic's outbound address range (each product's docs/specs/015-api/mcp-server.md "Claude connector directory"):
// every claude.ai user's connector reaches the MCP server from it, so a per-address limit sized for one person would
// stop all of them at once. https://claude.com/docs/connectors/building/authentication lists it.
export const ANTHROPIC_EGRESS_V4 = '160.79.104.0/21';

// 160.79.104.0/21 is 160.79.104.0 to 160.79.111.255: the first two octets fixed, the third 104 to 111.
const FIRST = 160;
const SECOND = 79;
const THIRD_LOW = 104;
const THIRD_HIGH = 111;

function octet(part: string | undefined): number | null {
  if (part === undefined || part.length === 0 || part.length > 3) return null;
  for (const ch of part) if (ch < '0' || ch > '9') return null;
  const value = Number(part);
  return value <= 255 ? value : null;
}

/** Whether an address (a rate-limit key: an IPv4 address as it is) is inside Anthropic's egress range. */
export function isAnthropicEgress(address: string): boolean {
  const parts = address.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(octet);
  if (octets.some((o) => o === null)) return false;
  const [a, b, c] = octets as number[];
  return a === FIRST && b === SECOND && c! >= THIRD_LOW && c! <= THIRD_HIGH;
}
