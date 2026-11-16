// A roadmap link's code and a visitor's voter id (docs/specs/026-plan/public-roadmap.md "Upvotes"; blueprint
// public-roadmap.md "Behaviour and state"). The code is 16 random bytes behind `lpr_`; the voter id is `rv:` and a
// salted hash of the browser key, so a browser's votes on one plan do not link it to another.
import { PUBLIC_VOTER_PREFIX } from '@liveplanner/items';

export const ROADMAP_CODE_PREFIX = 'lpr_';
export const ROADMAP_CODE_BYTES = 16;
// How much of the hash names a voter: 96 bits, far past any collision among a card's 500 voters.
const VOTER_HEX = 24;

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** A fresh roadmap code, `lpr_` and 22 base64url characters. */
export function newRoadmapCode(): string {
  return (
    ROADMAP_CODE_PREFIX + base64url(crypto.getRandomValues(new Uint8Array(ROADMAP_CODE_BYTES)))
  );
}

/** The voter id a browser key votes as on this plan. */
export async function publicVoterId(planId: string, browser: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${planId}:${browser}`),
  );
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return PUBLIC_VOTER_PREFIX + hex.slice(0, VOTER_HEX);
}
