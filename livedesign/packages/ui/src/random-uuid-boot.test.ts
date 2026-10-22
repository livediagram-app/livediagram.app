import { describe, expect, it } from 'vitest';
import { runInlineScript } from '@livedesign/vitest-config/inline-script';
import { RANDOM_UUID_BOOT_SCRIPT } from './random-uuid-boot';

// docs/specs/016-platform/secure-context.md, run as the browser runs it.
describe('the randomUUID boot script', () => {
  it('mints version 4 ids from getRandomValues where randomUUID is missing', () => {
    // Outside a secure context (an embed on a plain-http page) the browser leaves randomUUID out.
    const crypto: { getRandomValues: (b: Uint8Array) => Uint8Array; randomUUID?: () => string } = {
      getRandomValues: (b) => globalThis.crypto.getRandomValues(b),
    };
    runInlineScript(RANDOM_UUID_BOOT_SCRIPT, { crypto });
    const ids = Array.from({ length: 200 }, () => crypto.randomUUID!());
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps a real randomUUID, and never throws without crypto', () => {
    const real = () => 'real';
    const crypto = { getRandomValues: (b: Uint8Array) => b, randomUUID: real };
    runInlineScript(RANDOM_UUID_BOOT_SCRIPT, { crypto });
    expect(crypto.randomUUID).toBe(real);
    expect(() => runInlineScript(RANDOM_UUID_BOOT_SCRIPT, {})).not.toThrow();
  });
});
