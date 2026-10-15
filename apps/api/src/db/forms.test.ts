import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { claimFormEmail, createFormLink, generateFormCode } from './forms';

// form_links' helpers (docs/specs/030-forms/blueprints/forms.md §11).

describe('generateFormCode', () => {
  it('draws 22 base-62 characters, skipping the bytes that would bias it', () => {
    expect(generateFormCode()).toMatch(/^[A-Za-z0-9]{22}$/);
    let calls = 0;
    // The first draw is all biased bytes (248+), the next all zeros.
    const code = generateFormCode((n) => new Uint8Array(n).fill(calls++ === 0 ? 250 : 0));
    expect(code).toBe('A'.repeat(22));
  });
});

describe('claimFormEmail', () => {
  it('sends one email per window, then counts what it held', async () => {
    const { env, sql } = sqliteD1();
    sql.exec(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
    );
    const link = await createFormLink(env, 'd', 't', 1);
    const code = link!.code;
    expect(await claimFormEmail(env, code, 1000, 500)).toEqual({ send: true, heldBefore: 0 });
    expect(await claimFormEmail(env, code, 1100, 500)).toEqual({ send: false });
    expect(await claimFormEmail(env, code, 1200, 500)).toEqual({ send: false });
    expect(await claimFormEmail(env, code, 1600, 500)).toEqual({ send: true, heldBefore: 2 });
    expect(await claimFormEmail(env, 'missing', 1600, 500)).toEqual({ send: false });
    // A second live link for the same tab is refused.
    expect(await createFormLink(env, 'd', 't', 2)).toBeNull();
  });
});
