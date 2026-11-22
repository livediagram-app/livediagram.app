// A share's sign-in rule over HTTP (one-explorer-contracts.md "Sharing and access", Work Tracker 1330 and 1331):
// Require Sign In and email domains, set by the item's manager, checked on every door a link opens, for every level.
import type { Level, ShareLink, ShareSignInRule } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

const LEVELS: Level[] = ['edit', 'participate', 'view'];

async function share(auth: string, itemId: string, input: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  await settle();
  h.appCalls = [];
  return (await body<{ link: ShareLink }>(res)).link;
}

async function setRule(auth: string, itemId: string, rule: Record<string, unknown>) {
  return call(`/items/${itemId}/share-sign-in`, { method: 'PUT', auth, body: rule });
}

async function rule(auth: string, itemId: string, input: Record<string, unknown>) {
  const res = await setRule(auth, itemId, input);
  expect(res.status).toBe(200);
  await settle();
  return (await body<{ signIn: ShareSignInRule }>(res)).signIn;
}

// What a link opens for this bearer (or nobody), through the share page and the grant's door.
async function open(code: string, auth: string | null) {
  const page = await call(`/share/${code}`, { auth });
  return { status: page.status, body: await body<Record<string, unknown>>(page) };
}
async function grant(itemId: string, code: string, auth: string | null) {
  const res = await call(`/items/${itemId}/grant`, {
    method: 'POST',
    auth,
    headers: { 'X-Share-Code': code },
  });
  return { status: res.status, body: await body<Record<string, unknown>>(res) };
}

describe('the sign-in rule: setting it', () => {
  it('is off by default, set and read by the manager alone, with typed domains normalised', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const listed = await body<{ signIn: ShareSignInRule; suggestedDomain: string | null }>(
      await call(`/items/${item.id}/share`, { auth: ada.auth }),
    );
    expect(listed.signIn).toEqual({ requireAccount: false, domains: [] });
    // A personal item suggests no domain.
    expect(listed.suggestedDomain).toBeNull();

    expect(await rule(ada.auth, item.id, { requireAccount: true })).toEqual({
      requireAccount: true,
      domains: [],
    });
    // Domains imply Require Sign In; typed text splits at spaces and commas, @ and case dropped, repeats once.
    expect(
      await rule(ada.auth, item.id, {
        requireAccount: false,
        domains: '@Acme.com, liveworkspace.app acme.com',
      }),
    ).toEqual({ requireAccount: true, domains: ['acme.com', 'liveworkspace.app'] });
    const read = await body<{ signIn: ShareSignInRule }>(
      await call(`/items/${item.id}/share`, { auth: ada.auth }),
    );
    expect(read.signIn).toEqual({
      requireAccount: true,
      domains: ['acme.com', 'liveworkspace.app'],
    });
    // Someone else can't see it or set it.
    expect((await setRule(eve.auth, item.id, { requireAccount: false })).status).toBe(404);
    // Off removes it.
    expect(await rule(ada.auth, item.id, { requireAccount: false, domains: [] })).toEqual({
      requireAccount: false,
      domains: [],
    });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM share_sign_in').get()).toEqual({ n: 0 });
  });

  it('refuses a malformed rule, a name that is no domain and too many domains', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const refused = async (input: Record<string, unknown>) => {
      const res = await setRule(ada.auth, item.id, input);
      return { status: res.status, ...(await body<Record<string, unknown>>(res)) };
    };
    expect(await refused({ requireAccount: 'yes' })).toMatchObject({
      status: 400,
      error: 'invalid_sign_in',
    });
    expect(await refused({ requireAccount: true, domains: [1] })).toMatchObject({
      error: 'invalid_sign_in',
    });
    expect(await refused({ requireAccount: true, domains: 'acme.com localhost' })).toMatchObject({
      status: 400,
      error: 'invalid_domain',
      domain: 'localhost',
    });
    const many = Array.from({ length: 21 }, (_, i) => `d${i}.com`);
    expect(await refused({ requireAccount: true, domains: many })).toMatchObject({
      error: 'too_many_domains',
    });
  });

  it('starts a team item with the sharer’s own domain, never a public mail provider’s', async () => {
    const teams = [{ id: 'team1' }];
    const ada = await person('user_a', { teams, email: 'Ada@Acme.com' });
    const gus = await person('user_g', { teams, email: 'gus@gmail.com' });
    const una = await person('user_u', { teams, email: 'una@acme.com', emailVerified: false });
    const item = await makeItem(ada.auth, { teamId: 'team1' });
    const suggested = async (auth: string) =>
      (
        await body<{ suggestedDomain: string | null }>(
          await call(`/items/${item.id}/share`, { auth }),
        )
      ).suggestedDomain;
    expect(await suggested(ada.auth)).toBe('acme.com');
    expect(await suggested(gus.auth)).toBeNull();
    // An address accounts never verified is no one's domain.
    expect(await suggested(una.auth)).toBeNull();
  });

  it('sends everyone already in back through the check when it changes, and nobody when it goes off', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b', { email: 'bob@acme.com' });
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id);
    expect((await open(link.code, bob.auth)).status).toBe(200);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM shared_with').get()).toEqual({ n: 1 });
    h.appCalls = [];
    await rule(ada.auth, item.id, { requireAccount: true, domains: ['acme.com'] });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM shared_with').get()).toEqual({ n: 0 });
    expect(h.appCalls.map((c) => [c.url.split('/api/internal')[1], c.body])).toEqual([
      [`/items/${item.id}/revoke`, { codes: [link.code], reason: 'rescoped' }],
    ]);
    // Saved unchanged, and then off: nobody is sent away.
    h.appCalls = [];
    await rule(ada.auth, item.id, { requireAccount: true, domains: 'acme.com' });
    await rule(ada.auth, item.id, { requireAccount: false });
    expect(h.appCalls).toEqual([]);
  });

  it('is deleted with the item’s links when the item is archived', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await rule(ada.auth, item.id, { requireAccount: true });
    expect(
      (await call(`/items/${item.id}/archive`, { method: 'POST', auth: ada.auth })).status,
    ).toBe(200);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM share_sign_in').get()).toEqual({ n: 0 });
  });
});

describe('the sign-in rule: opening a link, for every level', () => {
  for (const level of LEVELS) {
    it(`Require Sign In: an account opens a ${level} link at its level; a guest and nobody are asked to sign in`, async () => {
      const ada = await person('user_a');
      const bob = await person('user_b');
      const guest = await person('guest_1', { guest: true });
      const item = await makeItem(ada.auth);
      const link = await share(ada.auth, item.id, { level });
      await rule(ada.auth, item.id, { requireAccount: true });

      const signedIn = await open(link.code, bob.auth);
      expect(signedIn.status).toBe(200);
      expect(signedIn.body.level).toBe(level);
      expect((await grant(item.id, link.code, bob.auth)).body.level).toBe(level);
      for (const auth of [guest.auth, null]) {
        expect(await open(link.code, auth)).toEqual({
          status: 401,
          body: { error: 'sign_in_required', domains: [] },
        });
        // The grant's door (every app's room join, embed and read) refuses the same.
        expect((await grant(item.id, link.code, auth)).body.error).toBe('sign_in_required');
      }
      // The owner reaches their item as ever.
      expect(
        (await call(`/items/${item.id}/grant`, { method: 'POST', auth: ada.auth })).status,
      ).toBe(200);
    });

    it(`email domains: a verified address at a listed domain opens a ${level} link; anyone else is refused`, async () => {
      const ada = await person('user_a');
      const bob = await person('user_b', { email: 'bob@Acme.com' });
      const eve = await person('user_e', { email: 'eve@evil.io' });
      const sub = await person('user_s', { email: 'sam@eng.acme.com' });
      const lookAlike = await person('user_l', { email: 'lou@acme.com.evil.io' });
      const unverified = await person('user_u', { email: 'una@acme.com', emailVerified: false });
      const noEmail = await person('user_n');
      const guest = await person('guest_2', { guest: true });
      const item = await makeItem(ada.auth);
      const link = await share(ada.auth, item.id, { level });
      await rule(ada.auth, item.id, { requireAccount: false, domains: 'acme.com other.org' });

      const allowed = await open(link.code, bob.auth);
      expect(allowed.status).toBe(200);
      expect(allowed.body.level).toBe(level);
      expect((await grant(item.id, link.code, bob.auth)).status).toBe(200);
      for (const who of [eve, sub, lookAlike, unverified, noEmail]) {
        expect(await open(link.code, who.auth)).toEqual({
          status: 403,
          body: { error: 'domain_not_allowed', domains: ['acme.com', 'other.org'] },
        });
        expect((await grant(item.id, link.code, who.auth)).status).toBe(403);
      }
      for (const auth of [guest.auth, null]) {
        expect(await open(link.code, auth)).toEqual({
          status: 401,
          body: { error: 'sign_in_required', domains: ['acme.com', 'other.org'] },
        });
      }
    });
  }

  it('checks the rule before the password, so it spends no guesses', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id);
    await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'hunter22' },
    });
    await rule(ada.auth, item.id, { requireAccount: true });
    const res = await call(`/share/${link.code}`, { headers: { 'X-Share-Password': 'wrong-one' } });
    expect(res.status).toBe(401);
    expect((await body<{ error: string }>(res)).error).toBe('sign_in_required');
  });

  it('holds on a reopen through Shared with me and in a lookup', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b', { email: 'bob@acme.com' });
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id);
    await rule(ada.auth, item.id, { requireAccount: true, domains: ['acme.com'] });
    expect((await open(link.code, bob.auth)).status).toBe(200);
    // Bob reopens it by its own address, no code: his Shared with me row admits him.
    expect((await call(`/items/${item.id}`, { auth: bob.auth })).status).toBe(200);
    const looked = async () =>
      (
        await body<{ items: { id: string }[] }>(
          await call('/items/lookup', { method: 'POST', auth: bob.auth, body: { ids: [item.id] } }),
        )
      ).items.map((i) => i.id);
    expect(await looked()).toEqual([item.id]);
    // Now the rule names another domain: the same row no longer opens it, nor lists it in a lookup.
    await call(`/items/${item.id}/share-sign-in`, {
      method: 'PUT',
      auth: ada.auth,
      body: { requireAccount: true, domains: ['other.org'] },
    });
    h.db.sql
      .prepare(
        'INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES (?, ?, ?, ?)',
      )
      .run('user_b', item.id, link.code, Date.now());
    expect((await call(`/items/${item.id}`, { auth: bob.auth })).status).toBe(403);
    expect(await looked()).toEqual([]);
  });

  it('closes a public link while a rule is set, and an app acting for an API token passes Require Sign In only', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const pub = await share(ada.auth, item.id, { public: true, level: 'view' });
    const link = await share(ada.auth, item.id);
    await rule(ada.auth, item.id, { requireAccount: true });
    expect((await open(pub.code, null)).status).toBe(404);
    // liveplanner's api, for an account it checked itself (an API token's): no email rides it.
    const delegate = (code: string) =>
      call(`/share/${code}`, {
        auth: 'lp-key',
        headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_d' },
      });
    expect((await delegate(link.code)).status).toBe(200);
    await rule(ada.auth, item.id, { requireAccount: true, domains: ['acme.com'] });
    expect((await delegate(link.code)).status).toBe(403);
  });
});
