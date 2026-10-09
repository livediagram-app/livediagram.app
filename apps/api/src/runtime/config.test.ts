import { readFileSync } from 'node:fs';
// The Node \`URL\`, not the platform global (@cloudflare/workers-types declares
// its own and the two are not interchangeable to the compiler).
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RUNTIME_CONFIG_KEYS } from './config';

// The configuration surface of a self-hosted deployment is derived from \`Env\`
// (apps/api/src/types.ts). This census fails the moment the two drift: a key added
// to \`Env\` and not to the list reads \`undefined\` on a self-host, which is a bug
// nobody sees until an operator sets the variable and nothing happens.

const TYPES = fileURLToPath(new URL('../types.ts', import.meta.url));

// Env's platform bindings, which the seam replaces and which are therefore not
// configuration.
const BINDINGS = new Set([
  'DB',
  'DOCUMENT_ROOM',
  'IMAGES',
  'WRITE_RATE_LIMITER',
  'EVENTS_RATE_LIMITER',
  'AI_RATE_LIMITER',
  'SHARE_RATE_LIMITER',
  'UNFURL_RATE_LIMITER',
  'API_TOKEN_READ_RATE_LIMITER',
  'DRIVE_TOKEN_RATE_LIMITER',
  'HOME_RATE_LIMITER',
  'COMMUNITY_RATE_LIMITER',
  'WORKBENCH_TICKET_RATE_LIMITER',
]);

describe('the runtime configuration surface', () => {
  it('names every Env member that is not a binding', () => {
    const source = readFileSync(TYPES, 'utf8');
    const start = source.indexOf('export type Env = {');
    const end = source.indexOf('export type Runtime =');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const declared = [...source.slice(start, end).matchAll(/^ {2}([A-Z][A-Z0-9_]*)\??:/gm)]
      .map((m) => m[1]!)
      .filter((key) => !BINDINGS.has(key));
    expect([...RUNTIME_CONFIG_KEYS].sort()).toEqual(declared.sort());
  });
});
