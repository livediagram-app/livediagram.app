import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  claimFormEmail,
  claimResponseNumber,
  createFormLink,
  deleteFormLink,
  generateFormCode,
  getFormLink,
  getLiveFormLink,
} from './forms';

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
      `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
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

describe('claimResponseNumber and deleteFormLink (docs/specs/030-forms/forms.md "Publishing and the form link")', () => {
  const setup = () => {
    const { env, sql } = sqliteD1();
    sql.exec(
      `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
    );
    return env;
  };

  it('never passes the Response Limit, however many arrive at once', async () => {
    const env = setup();
    const { code } = (await createFormLink(env, 'd', 't', 1))!;
    const got = await Promise.all(
      Array.from({ length: 5 }, () => claimResponseNumber(env, code, 5000, 500, 3)),
    );
    expect(got.filter((n) => n !== null).sort()).toEqual([1, 2, 3]);
    expect((await getFormLink(env, code))!.responses).toBe(3);
    // A preview passes the limit.
    expect(await claimResponseNumber(env, code, 5000, 500, null)).toBe(4);
  });

  it('keeps a deleted link so the next one carries its numbers on, its code answering no more', async () => {
    const env = setup();
    const first = (await createFormLink(env, 'd', 't', 1))!;
    await claimResponseNumber(env, first.code, 5000, 500);
    await claimResponseNumber(env, first.code, 5000, 500);
    await deleteFormLink(env, first.code, 6000);
    expect(await getLiveFormLink(env, 'd', 't')).toBeNull();
    expect(await getFormLink(env, first.code)).toMatchObject({ deleted_at: 6000, open: 0 });
    expect(await claimResponseNumber(env, first.code, 7000, 500)).toBeNull();
    const second = (await createFormLink(env, 'd', 't', 8000))!;
    expect(second.code).not.toBe(first.code);
    expect(await claimResponseNumber(env, second.code, 9000, 500)).toBe(3);
  });
});
