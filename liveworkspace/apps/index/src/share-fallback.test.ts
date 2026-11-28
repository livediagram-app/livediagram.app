// An editor address opened with no access (one-explorer-contracts.md "Opened by its editor address", Work Tracker
// 1518): the grant's refusal names the item's least live link, and the link's own door keeps every rule on it.
import type { ShareLink } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

async function share(auth: string, itemId: string, input: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  await settle();
  return (await body<{ link: ShareLink }>(res)).link;
}

// The grant an editor asks for by the item's own address: no code.
async function grant(itemId: string, auth: string | null, headers: Record<string, string> = {}) {
  const res = await call(`/items/${itemId}/grant`, { method: 'POST', auth, headers });
  return { status: res.status, body: await body<Record<string, unknown>>(res) };
}

// The grant through a code, as the editor asks once it follows the named link.
async function grantVia(itemId: string, code: string, auth: string | null, password?: string) {
  const headers: Record<string, string> = { 'X-Share-Code': code };
  if (password) headers['X-Share-Password'] = password;
  return grant(itemId, auth, headers);
}

const NOT_FOUND = { status: 404, body: { error: 'not_found' } };

describe('an editor address opened with no access', () => {
  it('answers a plain not-found, exactly as a missing item does, while the item has no live link', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    expect(await grant(item.id, eve.auth)).toEqual(NOT_FOUND);
    expect(await grant('00000000-0000-4000-8000-000000000000', eve.auth)).toEqual(NOT_FOUND);
  });

  it('names the one live link, which then opens at its own level', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'participate' });
    expect(await grant(item.id, eve.auth)).toEqual({
      status: 404,
      body: { error: 'not_found', link: link.code },
    });
    const through = await grantVia(item.id, link.code, eve.auth);
    expect(through.status).toBe(200);
    expect(through.body).toMatchObject({ level: 'participate', link: link.code });
  });

  it('names the link that gives least: the lowest level, then a one-tab link, then the oldest', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const edit = await share(ada.auth, item.id, { level: 'edit' });
    expect((await grant(item.id, eve.auth)).body.link).toBe(edit.code);
    const participate = await share(ada.auth, item.id, { level: 'participate' });
    expect((await grant(item.id, eve.auth)).body.link).toBe(participate.code);
    const view = await share(ada.auth, item.id, { level: 'view' });
    await share(ada.auth, item.id, { level: 'view' });
    expect((await grant(item.id, eve.auth)).body.link).toBe(view.code);
    const tab = await share(ada.auth, item.id, { level: 'view', tabId: 'tab-1' });
    expect((await grant(item.id, eve.auth)).body.link).toBe(tab.code);
  });

  it('never names an expired, deleted or public link, nor any link of an item in the Trash or Archived', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const lapsed = await share(ada.auth, item.id, { level: 'view', expiry: 'week' });
    h.db.sql.prepare('UPDATE share_links SET expires_at = 1 WHERE code = ?').run(lapsed.code);
    await share(ada.auth, item.id, { level: 'view', public: true });
    expect(await grant(item.id, eve.auth)).toEqual(NOT_FOUND);
    const live = await share(ada.auth, item.id, { level: 'edit' });
    expect((await grant(item.id, eve.auth)).body.link).toBe(live.code);
    await call(`/share/${live.code}`, { method: 'DELETE', auth: ada.auth });
    expect(await grant(item.id, eve.auth)).toEqual(NOT_FOUND);

    const binned = await makeItem(ada.auth);
    await share(ada.auth, binned.id, { level: 'view' });
    expect((await call(`/items/${binned.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    expect(await grant(binned.id, eve.auth)).toEqual(NOT_FOUND);

    const shelved = await makeItem(ada.auth);
    await share(ada.auth, shelved.id, { level: 'view' });
    h.db.sql.prepare('UPDATE items SET archived_at = 1 WHERE id = ?').run(shelved.id);
    expect(await grant(shelved.id, eve.auth)).toEqual(NOT_FOUND);
  });

  it('keeps the password at the link: named without it, opened only with it', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'hunter22' },
    });
    expect((await grant(item.id, eve.auth)).body).toEqual({ error: 'not_found', link: link.code });
    expect((await grantVia(item.id, link.code, eve.auth)).body).toEqual({
      error: 'password_required',
    });
    expect((await grantVia(item.id, link.code, eve.auth, 'wrong-one')).status).toBe(403);
    expect((await grantVia(item.id, link.code, eve.auth, 'hunter22')).body).toMatchObject({
      level: 'view',
    });
  });

  it('keeps Require Sign In and its domains at the link, for signed-out visitors, guests and accounts', async () => {
    const ada = await person('user_a');
    const guest = await person('guest_g', { guest: true });
    const other = await person('user_o', { email: 'o@elsewhere.org' });
    const acme = await person('user_c', { email: 'c@acme.com' });
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'participate' });
    await call(`/items/${item.id}/share-sign-in`, {
      method: 'PUT',
      auth: ada.auth,
      body: { requireAccount: true, domains: ['acme.com'] },
    });
    // Signed out (no token at all), a guest and an account: each is named the link.
    for (const auth of [null, guest.auth, other.auth, acme.auth]) {
      expect((await grant(item.id, auth)).body).toEqual({ error: 'not_found', link: link.code });
    }
    // At the link, the rule decides.
    expect((await grantVia(item.id, link.code, guest.auth)).body).toMatchObject({
      error: 'sign_in_required',
      domains: ['acme.com'],
    });
    expect((await grantVia(item.id, link.code, other.auth)).body).toMatchObject({
      error: 'domain_not_allowed',
    });
    expect((await grantVia(item.id, link.code, acme.auth)).body).toMatchObject({
      level: 'participate',
    });
  });

  it('lets the owner and a signed-in team member in as editors, with no link named and no prompt', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const mine = await makeItem(ada.auth);
    const team = await makeItem(ada.auth, { teamId: 'team1' });
    for (const item of [mine, team]) {
      await share(ada.auth, item.id, { level: 'view' });
      await call(`/items/${item.id}/share-password`, {
        method: 'PUT',
        auth: ada.auth,
        body: { password: 'hunter22' },
      });
      await call(`/items/${item.id}/share-sign-in`, {
        method: 'PUT',
        auth: ada.auth,
        body: { requireAccount: true, domains: ['acme.com'] },
      });
    }
    for (const [who, item] of [
      [ada, mine],
      [ada, team],
      [bob, team],
    ] as const) {
      const res = await grant(item.id, who.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ level: 'edit', tabId: null });
      expect(res.body.link).toBeUndefined();
    }
  });

  it('names no link to an app acting for a person, or to a request that sent a code of its own', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    await share(ada.auth, item.id, { level: 'view' });
    expect(
      await grant(item.id, 'lp-key', { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_e' }),
    ).toEqual(NOT_FOUND);
    expect(await grantVia(item.id, 'AAAAAAAAAAAAAA', eve.auth)).toEqual(NOT_FOUND);
  });
});
