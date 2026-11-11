import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WEBHOOK_SECRET_PREFIX } from '@liveplanner/items';
import { newHookSecret, provesSecret, sha256Hex } from './automation-incoming';

// The secret's proof (blueprint automations.md "Phase 3", "The secret"): the plan keeps only SHA-256(secret), and a
// signature keyed with the secret still checks, because HMAC hashes a key longer than its 64-byte block first
// (RFC 2104 §2). Both halves of that are pinned here, so a shorter secret fails loudly.
const BODY = new TextEncoder().encode('{"cards":[12],"build":{"status":"green"}}');
const call = (headers: { authorization?: string; signature?: string }) => ({
  body: BODY,
  authorization: headers.authorization ?? null,
  signature: headers.signature ?? null,
});

describe('a hook secret', () => {
  it('encodes to more than the 64-byte HMAC block, so its hash keys the same HMAC', () => {
    for (let i = 0; i < 20; i += 1) {
      const secret = newHookSecret();
      expect(secret.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
      expect(new TextEncoder().encode(secret).length).toBeGreaterThan(64);
    }
  });

  it('is proved by a signature a sender makes with the raw secret, as GitHub-style senders do', async () => {
    const secret = newHookSecret();
    const hash = await sha256Hex(secret);
    expect(hash).toBe(createHash('sha256').update(secret).digest('hex'));
    const sig = createHmac('sha256', secret).update(BODY).digest('hex');
    expect(await provesSecret(call({ signature: `sha256=${sig}` }), hash)).toBe(true);
    expect(await provesSecret(call({ authorization: `Bearer ${secret}` }), hash)).toBe(true);
    // Another secret's signature, another body's, and no stored hash all fail.
    const other = createHmac('sha256', newHookSecret()).update(BODY).digest('hex');
    expect(await provesSecret(call({ signature: `sha256=${other}` }), hash)).toBe(false);
    const changed = createHmac('sha256', secret).update('{}').digest('hex');
    expect(await provesSecret(call({ signature: `sha256=${changed}` }), hash)).toBe(false);
    expect(await provesSecret(call({ signature: `sha256=${sig}` }), null)).toBe(false);
  });

  it('would not be proved by a raw-secret signature were the secret 64 bytes or shorter', async () => {
    // The reason for the length guard: below the block, HMAC uses the key as it is, so the hash no longer stands in.
    const short = `${WEBHOOK_SECRET_PREFIX}${'a'.repeat(40)}`;
    const sig = createHmac('sha256', short).update(BODY).digest('hex');
    expect(await provesSecret(call({ signature: `sha256=${sig}` }), await sha256Hex(short))).toBe(
      false,
    );
  });
});
