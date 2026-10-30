import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkDeletionCode,
  closeAccount,
  deletionCodeRefusal,
  isDeletionCode,
  requestDeletionCode,
  sendDeletionCode,
} from './close-account';

// liveworkspace/docs/specs/003-accounts/sign-in.md "Closing an account": a code emailed, checked before the app deletes
// anything, and closed with.

const credentials = {
  accountsUrl: 'https://liveworkspace.app/',
  clientId: 'client-1',
  clientSecret: 's3cret',
};

const answering = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

const sentTo = (fetchImpl: ReturnType<typeof answering>) => {
  const [url, init] = fetchImpl.mock.calls[0]!;
  return {
    url: String(url),
    authorization: new Headers(init?.headers).get('authorization'),
    body: JSON.parse(String(init?.body)) as unknown,
    signal: init?.signal,
  };
};

afterEach(() => vi.restoreAllMocks());

describe('isDeletionCode', () => {
  it('takes six digits and nothing else', () => {
    expect(isDeletionCode('012345')).toBe(true);
    expect(isDeletionCode('12345')).toBe(false);
    expect(isDeletionCode('12345a')).toBe(false);
    expect(isDeletionCode(123456)).toBe(false);
  });
});

describe('sendDeletionCode', () => {
  it('asks with basic client auth and the access token, and gives up after a while', async () => {
    const fetchImpl = answering({ sent: true });
    expect(await sendDeletionCode(credentials, 'at', fetchImpl)).toBe('sent');
    const sent = sentTo(fetchImpl);
    expect(sent.url).toBe('https://liveworkspace.app/api/auth/delete-account/code');
    expect(sent.authorization).toBe(`Basic ${btoa('client-1:s3cret')}`);
    expect(sent.body).toEqual({ token: 'at' });
    expect(sent.signal).toBeInstanceOf(AbortSignal);
  });

  it('says when the address is over its limit, and throws on anything else', async () => {
    expect(await sendDeletionCode(credentials, 'at', answering({}, 429))).toBe('rate_limited');
    await expect(
      sendDeletionCode(credentials, 'at', answering({ error: 'invalid_token' }, 401)),
    ).rejects.toThrow('sending the deletion code failed (401)');
  });
});

describe('checkDeletionCode', () => {
  it('sends the code with the token', async () => {
    const fetchImpl = answering({ ok: true });
    expect(await checkDeletionCode(credentials, 'at', '123456', fetchImpl)).toBe('ok');
    expect(sentTo(fetchImpl)).toMatchObject({
      url: 'https://liveworkspace.app/api/auth/delete-account/check',
      body: { token: 'at', code: '123456' },
    });
  });

  it.each(['invalid_code', 'too_many_attempts'] as const)('answers %s', async (error) => {
    expect(await checkDeletionCode(credentials, 'at', '1', answering({ error }, 403))).toBe(error);
  });

  it('says when the account is over its limit, and throws on any other refusal', async () => {
    expect(await checkDeletionCode(credentials, 'at', '1', answering({}, 429))).toBe(
      'rate_limited',
    );
    await expect(
      checkDeletionCode(credentials, 'at', '1', answering({ error: 'other' }, 403)),
    ).rejects.toThrow('checking the deletion code failed (403)');
    await expect(
      checkDeletionCode(
        credentials,
        'at',
        '1',
        vi.fn<typeof fetch>(async () => new Response('nope', { status: 403 })),
      ),
    ).rejects.toThrow('(403): nope');
  });
});

describe('closeAccount', () => {
  it('sends the access token and the code with basic client auth, with no timeout', async () => {
    const fetchImpl = answering({ deleted: true });
    await closeAccount(credentials, 'at', '123456', fetchImpl);
    const sent = sentTo(fetchImpl);
    expect(sent.url).toBe('https://liveworkspace.app/api/auth/delete-account');
    expect(sent.body).toEqual({ token: 'at', code: '123456' });
    expect(sent.signal).toBeUndefined();
  });

  it('throws when the account was not closed', async () => {
    await expect(
      closeAccount(credentials, 'at', '123456', answering({ error: 'invalid_code' }, 403)),
    ).rejects.toThrow('closing the account failed (403)');
  });
});

describe('an app’s answers', () => {
  it('asks for a code, or says why it could not', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await requestDeletionCode(null, 'at')).toEqual({
      status: 503,
      body: { error: 'accounts_unavailable' },
    });
    expect(await requestDeletionCode(credentials, null)).toEqual({
      status: 401,
      body: { error: 'signed_out' },
    });
    expect(await requestDeletionCode(credentials, 'at', answering({ sent: true }))).toEqual({
      status: 200,
      body: { sent: true },
    });
    expect(await requestDeletionCode(credentials, 'at', answering({}, 429))).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
    expect(await requestDeletionCode(credentials, 'at', answering({}, 500))).toEqual({
      status: 502,
      body: { error: 'code_not_sent' },
    });
  });

  it('lets the delete go ahead only with the right code', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await deletionCodeRefusal(credentials, 'at', '123456', answering({ ok: true }))).toBe(
      null,
    );
    expect(await deletionCodeRefusal(null, 'at', '123456')).toMatchObject({ status: 503 });
    expect(await deletionCodeRefusal(credentials, null, '123456')).toMatchObject({ status: 401 });
    expect(await deletionCodeRefusal(credentials, 'at', undefined)).toEqual({
      status: 400,
      body: { error: 'code_required' },
    });
    expect(
      await deletionCodeRefusal(
        credentials,
        'at',
        '123456',
        answering({ error: 'invalid_code' }, 403),
      ),
    ).toEqual({ status: 403, body: { error: 'invalid_code' } });
    expect(await deletionCodeRefusal(credentials, 'at', '123456', answering({}, 429))).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
    expect(await deletionCodeRefusal(credentials, 'at', '123456', answering({}, 500))).toEqual({
      status: 502,
      body: { error: 'code_not_checked' },
    });
  });
});
