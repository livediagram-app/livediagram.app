import { describe, expect, it } from 'vitest';
import { CliError, type CliFailure } from '../output/cli-error';
import { fakeIo, TOKEN } from '../testing/fake-io';
import {
  forgetCredential,
  resolveCredential,
  storeCredential,
  storedCredential,
  type StoredCredential,
} from './credentials';

const FILE = '/home/agent/.config/livediagram/credentials.json';
const stored: StoredCredential = {
  host: 'https://livediagram.app',
  token: TOKEN,
  tokenId: 't1',
  accountName: 'Ada',
  role: 'full',
  expiresAt: null,
};

const { token: _token, ...details } = stored;
const quiet = () => {};

async function failureOf(fn: () => unknown): Promise<CliFailure> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

describe('credentials', () => {
  it("prefers LIVEDIAGRAM_TOKEN, then the profile's stored token, else none", async () => {
    const io = fakeIo({ env: { LIVEDIAGRAM_TOKEN: ` ${TOKEN} ` } });
    expect(await resolveCredential(io, 'default')).toEqual({ token: TOKEN, source: 'env' });
    const plain = fakeIo();
    expect(await resolveCredential(plain, 'default')).toBeNull();
    await storeCredential(plain, 'default', details, TOKEN, quiet);
    expect(await resolveCredential(plain, 'default')).toEqual({ token: TOKEN, source: 'file' });
    expect(await storedCredential(plain, 'other')).toBeNull();
  });

  it('stores at 0600 and forgets one profile, keeping the others', async () => {
    const io = fakeIo();
    await storeCredential(io, 'default', details, TOKEN, quiet);
    await storeCredential(io, 'work', { ...details, tokenId: 't2' }, TOKEN, quiet);
    expect(io.fileMap.get(FILE)?.mode).toBe(0o600);
    await forgetCredential(io, 'default');
    expect(JSON.parse(io.fileMap.get(FILE)!.data)).toEqual({
      version: 1,
      profiles: { work: { ...stored, tokenId: 't2' } },
    });
  });

  it('tightens a file others can read, with a warning', async () => {
    const io = fakeIo();
    io.fileMap.set(FILE, {
      data: JSON.stringify({ version: 1, profiles: { default: stored } }),
      mode: 0o644,
    });
    expect(await storedCredential(io, 'default')).toEqual(stored);
    expect(io.fileMap.get(FILE)?.mode).toBe(0o600);
    expect(io.err()).toBe(
      `warning: ${FILE} was readable by others; it is now readable only by you\n`,
    );
  });

  it('refuses a malformed token in the environment and a file that does not read', async () => {
    expect(
      await failureOf(() =>
        resolveCredential(fakeIo({ env: { LIVEDIAGRAM_TOKEN: 'eyJ.jwt' } }), 'default'),
      ),
    ).toMatchObject({ exit: 4 });
    for (const data of ['{', '{"version":2,"profiles":{}}', '{"version":1,"profiles":null}'])
      expect(
        await failureOf(() => resolveCredential(fakeIo({ files: { [FILE]: data } }), 'default')),
      ).toMatchObject({
        exit: 2,
        message: `${FILE} does not read as livediagram credentials`,
      });
  });
});
