import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The like key is minted with crypto.randomUUID (lib/community-key.ts), which a page outside a secure context does
// not have (docs/specs/016-platform/secure-context.md): the shared boot script installs it before any app code.
const LAYOUT = readFileSync(fileURLToPath(new URL('./layout.tsx', import.meta.url)), 'utf8');

describe('the Community layout', () => {
  it('inlines the randomUUID boot script straight after Trusted Types', () => {
    const tt = LAYOUT.indexOf('trustedHtml(TRUSTED_TYPES_BOOT)');
    const uuid = LAYOUT.indexOf('trustedHtml(RANDOM_UUID_BOOT_SCRIPT)');
    expect(tt).toBeGreaterThan(-1);
    expect(uuid).toBeGreaterThan(tt);
    expect(uuid).toBeLessThan(LAYOUT.indexOf('trustedHtml(APPEARANCE_BOOT_SCRIPT)'));
  });
});
