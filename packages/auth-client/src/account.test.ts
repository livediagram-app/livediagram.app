import { describe, expect, it } from 'vitest';
import {
  accountEmails,
  claimMilestone,
  createTeamFor,
  createTokenChecker,
  fetchTeamChanges,
  mintAccountToken,
  ProfileError,
  readProfiles,
  readSettings,
  recordSighting,
  SettingsError,
  TeamError,
  writeProfile,
  writeSettings,
} from './account';

const CREDENTIALS = {
  accountsUrl: 'https://liveworkspace.app/',
  clientId: 'liveplanner',
  clientSecret: 's3cret',
};

const ACCOUNT = {
  tokenId: 'tok1',
  userId: 'user_1',
  email: 'ada@example.com',
  readOnly: false,
  expiresAt: Date.now() + 86_400_000,
  teams: [{ id: 't1', name: 'Design', role: 'member' }],
};

function fakeFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('createTokenChecker', () => {
  it('asks liveworkspace once with the client credentials, then remembers', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json(ACCOUNT));
    const check = createTokenChecker(CREDENTIALS, { fetcher });
    await expect(check('lwt_abc')).resolves.toEqual(ACCOUNT);
    await expect(check('lwt_abc')).resolves.toEqual(ACCOUNT);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/tokens/verify');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${btoa('liveplanner:s3cret')}`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ token: 'lwt_abc' });
  });

  it('asks again once the answer is older than it may be trusted', async () => {
    let at = 1_000;
    const { fetcher, calls } = fakeFetch(() => Response.json(ACCOUNT));
    const check = createTokenChecker(CREDENTIALS, { fetcher, now: () => at, validForMs: 60_000 });
    await check('lwt_abc');
    at += 59_000;
    await check('lwt_abc');
    at += 2_000;
    await check('lwt_abc');
    expect(calls).toHaveLength(2);
  });

  it('remembers an unknown token as refused, briefly', async () => {
    let at = 1_000;
    const { fetcher, calls } = fakeFetch(() =>
      Response.json({ error: 'invalid_token' }, { status: 404 }),
    );
    const check = createTokenChecker(CREDENTIALS, { fetcher, now: () => at });
    await expect(check('lwt_bad')).resolves.toBeNull();
    await expect(check('lwt_bad')).resolves.toBeNull();
    at += 11_000;
    await check('lwt_bad');
    expect(calls).toHaveLength(2);
  });

  it('throws when liveworkspace fails, rather than calling the token bad', async () => {
    const { fetcher } = fakeFetch(() => new Response('down', { status: 502 }));
    await expect(createTokenChecker(CREDENTIALS, { fetcher })('lwt_abc')).rejects.toThrow();
  });

  it('keeps at most maxEntries answers', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json(ACCOUNT));
    const check = createTokenChecker(CREDENTIALS, { fetcher, maxEntries: 2 });
    await check('lwt_a');
    await check('lwt_b');
    await check('lwt_c');
    await check('lwt_a');
    expect(calls).toHaveLength(4);
  });
});

describe('mintAccountToken', () => {
  it('sends the access token that vouches for the person', async () => {
    const { fetcher, calls } = fakeFetch(() =>
      Response.json({ id: 'tok', secret: 'lwt_x' }, { status: 201 }),
    );
    const minted = await mintAccountToken(
      CREDENTIALS,
      { accessToken: 'jwt', name: 'Claude', readOnly: true },
      fetcher,
    );
    expect(minted).toMatchObject({ secret: 'lwt_x' });
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/tokens');
  });

  it('answers null at the token limit', async () => {
    const { fetcher } = fakeFetch(() => Response.json({}, { status: 409 }));
    await expect(
      mintAccountToken(CREDENTIALS, { accessToken: 'jwt', name: 'x', readOnly: false }, fetcher),
    ).resolves.toBeNull();
  });
});

describe('fetchTeamChanges', () => {
  it('passes the cursor along', async () => {
    const { fetcher, calls } = fakeFetch(() =>
      Response.json({ teams: [], members: [], cursor: '3:a,4:b', more: false }),
    );
    await fetchTeamChanges(CREDENTIALS, '1:a,2:b', fetcher);
    expect(calls[0]!.url).toBe(
      'https://liveworkspace.app/api/account/internal/teams/changes?cursor=1%3Aa%2C2%3Ab',
    );
  });
});

describe('settings', () => {
  const SETTINGS = { all: { theme: 'dark' }, app: { snap: true }, updatedAt: 1_000 };
  const owner = 'user_1';

  it("reads one app's settings for an owner", async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json(SETTINGS));
    await expect(
      readSettings(CREDENTIALS, { owner, app: 'livediagram.app' }, fetcher),
    ).resolves.toEqual(SETTINGS);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/settings/read');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ owner, app: 'livediagram.app' });
  });

  it('sends a patch and answers the merged settings', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json(SETTINGS));
    const patch = { all: { theme: 'dark', locale: null }, app: { snap: true } };
    await expect(
      writeSettings(CREDENTIALS, { owner, app: 'livediagram.app', patch }, fetcher),
    ).resolves.toEqual(SETTINGS);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/settings/write');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      owner,
      app: 'livediagram.app',
      patch,
    });
  });

  it("throws the refusal's code, and plain errors otherwise", async () => {
    const tooLarge = fakeFetch(() =>
      Response.json({ error: 'settings_too_large' }, { status: 413 }),
    );
    const refused = writeSettings(
      CREDENTIALS,
      { owner, app: 'liveplanner.app', patch: { app: { big: 'x' } } },
      tooLarge.fetcher,
    );
    await expect(refused).rejects.toBeInstanceOf(SettingsError);
    await expect(refused).rejects.toMatchObject({ status: 413, code: 'settings_too_large' });
    const down = fakeFetch(() => new Response(null, { status: 503 }));
    await expect(
      readSettings(CREDENTIALS, { owner, app: 'liveplanner.app' }, down.fetcher),
    ).rejects.toThrow('settings read failed: 503');
  });
});

describe('createTeamFor', () => {
  it('sends the access token that vouches for the person, and answers the team', async () => {
    const { fetcher, calls } = fakeFetch(() =>
      Response.json({ id: 't1', name: 'Design', role: 'admin' }, { status: 201 }),
    );
    const team = await createTeamFor(
      CREDENTIALS,
      { accessToken: 'jwt', name: 'Design', organisation: 'Acme' },
      fetcher,
    );
    expect(team).toMatchObject({ id: 't1', role: 'admin' });
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/teams');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      accessToken: 'jwt',
      name: 'Design',
      organisation: 'Acme',
    });
  });

  it('throws a TeamError with the code when refused', async () => {
    const { fetcher } = fakeFetch(() =>
      Response.json({ error: 'team_limit_reached' }, { status: 409 }),
    );
    const refused = createTeamFor(CREDENTIALS, { accessToken: 'jwt', name: 'x' }, fetcher);
    await expect(refused).rejects.toBeInstanceOf(TeamError);
    await expect(refused).rejects.toMatchObject({ status: 409, code: 'team_limit_reached' });
  });

  it('throws a plain error when the account API fails', async () => {
    const { fetcher } = fakeFetch(() => new Response('', { status: 502 }));
    await expect(
      createTeamFor(CREDENTIALS, { accessToken: 'jwt', name: 'x' }, fetcher),
    ).rejects.toThrow('team create failed: 502');
  });
});

describe('readProfiles', () => {
  it('asks once per id, in batches of at most 100, and joins the answers', async () => {
    const { fetcher, calls } = fakeFetch((_url, init) => {
      const { ids } = JSON.parse(String(init.body)) as { ids: string[] };
      return Response.json({ profiles: ids.map((id) => ({ id, name: id, color: null })) });
    });
    const ids = Array.from({ length: 250 }, (_, i) => `user_${i}`);
    const profiles = await readProfiles(CREDENTIALS, [...ids, 'user_0'], fetcher);
    expect(profiles).toHaveLength(250);
    expect(
      calls.map((c) => (JSON.parse(String(c.init.body)) as { ids: string[] }).ids.length),
    ).toEqual([100, 100, 50]);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/profiles/read');
  });

  it('makes no call for no ids', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json({ profiles: [] }));
    expect(await readProfiles(CREDENTIALS, [], fetcher)).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('writeProfile', () => {
  it('answers the profile as it now is', async () => {
    const { fetcher, calls } = fakeFetch(() =>
      Response.json({ profile: { id: 'user_1', name: 'Ada', color: '#fff' } }),
    );
    const profile = await writeProfile(CREDENTIALS, { owner: 'user_1', color: '#fff' }, fetcher);
    expect(profile).toMatchObject({ name: 'Ada' });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ owner: 'user_1', color: '#fff' });
  });

  it('throws a ProfileError with the code when refused', async () => {
    const { fetcher } = fakeFetch(() => Response.json({ error: 'invalid_color' }, { status: 400 }));
    await expect(
      writeProfile(CREDENTIALS, { owner: 'user_1', color: 'url(x)' }, fetcher),
    ).rejects.toMatchObject({ name: 'ProfileError', code: 'invalid_color' });
    expect(ProfileError).toBeTypeOf('function');
  });
});

describe('recordSighting and claimMilestone', () => {
  it('answer whether this was the first time', async () => {
    const { fetcher, calls } = fakeFetch((url) =>
      Response.json(url.endsWith('/sightings') ? { first: true } : { claimed: false }),
    );
    expect(await recordSighting(CREDENTIALS, 'user_1', fetcher)).toBe(true);
    expect(
      await claimMilestone(CREDENTIALS, { userId: 'user_1', milestone: 'firstShare' }, fetcher),
    ).toBe(false);
    expect(calls.map((c) => c.url)).toEqual([
      'https://liveworkspace.app/api/account/internal/sightings',
      'https://liveworkspace.app/api/account/internal/milestones/claim',
    ]);
  });

  it('throw when the account API fails', async () => {
    const { fetcher } = fakeFetch(() => new Response('', { status: 403 }));
    await expect(recordSighting(CREDENTIALS, 'user_1', fetcher)).rejects.toThrow('403');
  });
});

describe('accountEmails', () => {
  it('asks in batches of at most 100 and joins the answers', async () => {
    const { fetcher, calls } = fakeFetch((_url, init) => {
      const { ids } = JSON.parse(String(init.body)) as { ids: string[] };
      return Response.json({ emails: Object.fromEntries(ids.map((id) => [id, `${id}@x`])) });
    });
    const ids = Array.from({ length: 150 }, (_, i) => `user_${i}`);
    const emails = await accountEmails(CREDENTIALS, ids, fetcher);
    expect(Object.keys(emails)).toHaveLength(150);
    expect(calls).toHaveLength(2);
  });
});
