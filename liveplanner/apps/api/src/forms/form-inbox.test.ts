// A form's place in liveworkspace's Inbox: its live link pushed with its heading, board and counts, gone once the link
// is, and a reader's seen count; a failing index never fails the caller.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimResponseNumber, createFormLink, deleteFormLink } from '../db/forms';
import { INDEX_ON } from '../test-accounts';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { pushFormInbox, pushFormInboxByCode, pushFormSeenInbox } from './form-inbox';

function setup() {
  const { env, sql } = sqliteD1();
  sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
  );
  const calls: { path: string; body: unknown }[] = [];
  let status = 204;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ path: url.pathname, body: JSON.parse(typeof init?.body === 'string' ? init.body : 'null') });
    return new Response(status === 204 ? null : '{"error":"down"}', { status });
  });
  return {
    env: { ...env, ...INDEX_ON } as Env,
    sql,
    calls,
    fail: () => {
      status = 500;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('the form Inbox push', () => {
  it('sends the live form, a response more, a reader’s seen count, and null once deleted', async () => {
    const { env, sql, calls } = setup();
    const { code } = (await createFormLink(env, 'd', 't', 100))!;
    sql.exec(
      `UPDATE form_links SET heading = 'Bug Report', board_tab_id = 'b' WHERE code = '${code}'`,
    );
    await pushFormInbox(env, 'd', 't');
    await claimResponseNumber(env, code, 200, 500);
    await pushFormInboxByCode(env, code);
    await pushFormSeenInbox(env, 'd', 't', 'user_a');
    await deleteFormLink(env, code, 300);
    await pushFormInbox(env, 'd', 't');
    // No live link: no seen count to send.
    await pushFormSeenInbox(env, 'd', 't', 'user_a');
    expect(calls.map((c) => [c.path.replace(/^.*\/app\//, ''), c.body])).toEqual([
      [
        'items/d/forms/t',
        { form: { heading: 'Bug Report', boardTabId: 'b', responses: 0, latestAt: 100 } },
      ],
      [
        'items/d/forms/t',
        { form: { heading: 'Bug Report', boardTabId: 'b', responses: 1, latestAt: 200 } },
      ],
      ['items/d/forms/t/seen', { personId: 'user_a', seen: 1 }],
      ['items/d/forms/t', { form: null }],
    ]);
  });

  it('never throws when the index is down', async () => {
    const { env, fail } = setup();
    await createFormLink(env, 'd', 't', 1);
    fail();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(pushFormInbox(env, 'd', 't')).resolves.toBeUndefined();
    await expect(pushFormSeenInbox(env, 'd', 't', 'user_a')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
