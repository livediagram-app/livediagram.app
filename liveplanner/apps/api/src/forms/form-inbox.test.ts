// A form's place in liveworkspace's index: its live link pushed with its heading, board, counts and code, gone once
// the link is, a reader's seen count read and written there, and the plan a code names found there. A failing index
// never fails a best-effort push; a new link's registration and a code's lookup say it failed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimResponseNumber, createFormLink, deleteFormLink } from '../db/forms';
import { INDEX_ON } from '../test-accounts';
import { sqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import {
  formPlaceOf,
  pushFormInbox,
  pushFormInboxByCode,
  pushFormSeenInbox,
  registerFormInbox,
  unseenFormResponses,
} from './form-inbox';

function setup() {
  const { env, sql } = sqliteD1();
  sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
  );
  const calls: { method: string; path: string; body: unknown }[] = [];
  let status = 204;
  const answers = new Map<string, unknown>();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = url.pathname.replace(/^.*\/app\//, '');
    calls.push({
      method: init?.method ?? 'GET',
      path,
      body: JSON.parse(typeof init?.body === 'string' ? init.body : 'null'),
    });
    if (status !== 204) return new Response('{"error":"down"}', { status });
    if ((init?.method ?? 'GET') === 'GET') {
      return answers.has(path)
        ? Response.json(answers.get(path))
        : Response.json({ error: 'not_found' }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  });
  return {
    env: { ...env, ...INDEX_ON } as PlanEnv,
    sql,
    calls,
    answers,
    fail: () => {
      status = 500;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('the form Inbox push', () => {
  it('sends the live form with its code, a response more, a reader’s seen count, and null once deleted', async () => {
    const { env, sql, calls } = setup();
    const { code } = (await createFormLink(env, 'd', 't', 100))!;
    sql.exec(
      `UPDATE form_links SET heading = 'Bug Report', board_tab_id = 'b' WHERE code = '${code}'`,
    );
    await registerFormInbox(env, 'd', 't');
    await claimResponseNumber(env, code, 200, 500);
    await pushFormInboxByCode(env, code);
    await pushFormSeenInbox(env, 'd', 't', 'user_a');
    await deleteFormLink(env, code, 300);
    await pushFormInbox(env, 'd', 't');
    // No live link: no seen count to send.
    await pushFormSeenInbox(env, 'd', 't', 'user_a');
    expect(calls.map((c) => [c.path, c.body])).toEqual([
      [
        'items/d/forms/t',
        { form: { heading: 'Bug Report', boardTabId: 'b', responses: 0, latestAt: 100, code } },
      ],
      [
        'items/d/forms/t',
        { form: { heading: 'Bug Report', boardTabId: 'b', responses: 1, latestAt: 200, code } },
      ],
      ['items/d/forms/t/seen', { personId: 'user_a', seen: 1 }],
      ['items/d/forms/t', { form: null }],
    ]);
  });

  it('never throws on a best-effort push when the index is down; a registration does', async () => {
    const { env, fail } = setup();
    await createFormLink(env, 'd', 't', 1);
    fail();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(pushFormInbox(env, 'd', 't')).resolves.toBeUndefined();
    await expect(pushFormSeenInbox(env, 'd', 't', 'user_a')).resolves.toBeUndefined();
    expect(await unseenFormResponses(env, 'd', 't', 'user_a', 4)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(3);
    await expect(registerFormInbox(env, 'd', 't')).rejects.toThrow();
    warn.mockRestore();
  });

  it('counts what a reader has not seen from the index, and needs an index to register', async () => {
    const { env, answers } = setup();
    answers.set('items/d/forms/t/seen/user_a', { seen: 3 });
    expect(await unseenFormResponses(env, 'd', 't', 'user_a', 5)).toBe(2);
    expect(await unseenFormResponses(env, 'd', 't', 'user_b', 5)).toBe(5);
    const { env: bare } = sqliteD1();
    expect(await unseenFormResponses(bare, 'd', 't', 'user_a', 5)).toBe(0);
    await expect(registerFormInbox(bare, 'd', 't')).rejects.toThrow('index_unavailable');
    await expect(formPlaceOf(bare, 'Code0001')).rejects.toThrow('index_unavailable');
  });

  it('finds the plan a code names, once per code for a while', async () => {
    const { env, answers, calls } = setup();
    answers.set('forms/Abcd1234', { itemId: 'd', tabId: 't' });
    expect(await formPlaceOf(env, 'Abcd1234')).toEqual({ itemId: 'd', tabId: 't' });
    expect(await formPlaceOf(env, 'Abcd1234')).toEqual({ itemId: 'd', tabId: 't' });
    expect(await formPlaceOf(env, 'Zzzz9999')).toBeNull();
    expect(calls.map((c) => c.path)).toEqual(['forms/Abcd1234', 'forms/Zzzz9999']);
  });
});
