// Refused webhook signatures, limited per network (docs/specs/026-plan/github-pull-requests.md "Deliveries"; blueprint
// "Part 2" "The worker's doors"). Only a refusal counts against the network's share of the write limit, never a
// delivery that signs right; a network over it is turned away for a minute before its body is read or hashed. GitHub's
// own webhook addresses are never limited, so someone else's hook with a wrong secret, sent from GitHub, cannot get
// the App's deliveries turned away with it.
import { clientIp, clientNetwork } from '@liveworkspace/api-kit/client-ip';
import { expandIpv6, unmappedAddress } from '@liveworkspace/sites/network';
import type { Env } from '../types';
import { REFUSED_NETWORK_TURNED_AWAY_MS, REFUSED_NETWORKS_KEPT } from './github-config';

type Range = { v6: boolean; base: number; bits: number };

// GitHub's `/meta` `hooks` ranges. Every prefix is 32 bits or shorter, so an address is compared on its first 32.
const range = (v6: boolean, base: number, bits: number): Range => ({ v6, base, bits });
export const GITHUB_HOOK_RANGES: readonly Range[] = [
  range(false, 0xc01efc00, 22), // 192.30.252.0/22
  range(false, 0xb9c76c00, 22), // 185.199.108.0/22
  range(false, 0x8c527000, 20), // 140.82.112.0/20
  range(false, 0x8f374000, 20), // 143.55.64.0/20
  range(true, 0x2a0aa440, 29), // 2a0a:a440::/29
  range(true, 0x260650c0, 32), // 2606:50c0::/32
];

// An address's first 32 bits, or null when it is not one.
function headOf(ip: string): { v6: boolean; head: number } | null {
  const address = unmappedAddress(ip);
  const hextets = expandIpv6(address);
  if (hextets) return { v6: true, head: parseInt(hextets[0]! + hextets[1]!, 16) >>> 0 };
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let head = 0;
  for (const part of parts) {
    if (part.length < 1 || part.length > 3) return null;
    for (let i = 0; i < part.length; i += 1) {
      const c = part.charCodeAt(i);
      if (c < 48 || c > 57) return null;
    }
    const n = Number(part);
    if (n > 255) return null;
    head = head * 256 + n;
  }
  return { v6: false, head };
}

/** Whether `ip` is one of GitHub's webhook addresses. */
export function isGithubHookAddress(ip: string): boolean {
  const a = headOf(ip);
  if (!a) return false;
  return GITHUB_HOOK_RANGES.some(
    (r) => r.v6 === a.v6 && a.head >>> (32 - r.bits) === r.base >>> (32 - r.bits),
  );
}

/** The caller's network, as its refusals are counted, or null for GitHub's own addresses (never limited). */
export function refusalNetwork(request: Request): string | null {
  const ip = clientIp(request);
  return isGithubHookAddress(ip) ? null : clientNetwork(ip);
}

// The networks turned away, each with when it may come back; insertion order is age, so the oldest goes first.
const turnedAway = new Map<string, number>();

/** Whether the network is turned away now. */
export function isTurnedAway(network: string, now: number): boolean {
  const until = turnedAway.get(network);
  if (until === undefined) return false;
  if (until > now) return true;
  turnedAway.delete(network);
  return false;
}

/** One refusal counted against the network; true when it is over the limit, and turned away from now. */
export async function countRefusal(env: Env, network: string, now: number): Promise<boolean> {
  if (!env.WRITE_RATE_LIMITER) return false;
  const { success } = await env.WRITE_RATE_LIMITER.limit({ key: `github-refused:${network}` });
  if (success) return false;
  turnedAway.delete(network);
  turnedAway.set(network, now + REFUSED_NETWORK_TURNED_AWAY_MS);
  while (turnedAway.size > REFUSED_NETWORKS_KEPT)
    turnedAway.delete(turnedAway.keys().next().value!);
  return true;
}

/** How many networks are turned away (for the tests). */
export const turnedAwayCount = (): number => turnedAway.size;
