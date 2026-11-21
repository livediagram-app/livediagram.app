import { describe, expect, it } from 'vitest';
import { KeySealError, MAX_API_KEY_CHARS, keyHint, openApiKey, sealApiKey } from './key-seal';

const SECRET = 'worker-secret-for-tests';
const KEY = 'sk-ant-api03-not-a-real-key-4f2a';

const rejection = async (work: Promise<unknown>): Promise<Error> => {
  try {
    await work;
  } catch (error) {
    return error as Error;
  }
  throw new Error('did not reject');
};

// One character of an envelope's part changed to another base64url character.
const tampered = (envelope: string, part: 1 | 2): string => {
  const parts = envelope.split('.');
  const at = Math.floor(parts[part]!.length / 2);
  const was = parts[part]![at]!;
  parts[part] =
    `${parts[part]!.slice(0, at)}${was === 'A' ? 'B' : 'A'}${parts[part]!.slice(at + 1)}`;
  return parts.join('.');
};

describe("sealing the team's key", () => {
  it('round trips', async () => {
    const envelope = await sealApiKey(SECRET, KEY, 'doc-1');
    expect(envelope).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(await openApiKey(SECRET, envelope, 'doc-1')).toBe(KEY);
    expect(await openApiKey(SECRET, await sealApiKey(SECRET, 'kéy-ü-✓-long-enough'))).toBe(
      'kéy-ü-✓-long-enough',
    );
  });

  it('uses a fresh IV each time', async () => {
    const [one, two] = await Promise.all([sealApiKey(SECRET, KEY), sealApiKey(SECRET, KEY)]);
    expect(one).not.toBe(two);
    expect(one.split('.')[1]).not.toBe(two.split('.')[1]);
  });

  it('never holds the key in the envelope', async () => {
    const envelope = await sealApiKey(SECRET, KEY);
    expect(envelope).not.toContain(KEY);
    expect(envelope).not.toContain(KEY.slice(-8));
    expect(envelope).not.toContain(btoa(KEY).replace(/=+$/, ''));
    expect(envelope).not.toContain(SECRET);
  });

  it('fails closed on a wrong secret, and on another knowledgebase', async () => {
    const envelope = await sealApiKey(SECRET, KEY, 'doc-1');
    // Each open starts only when awaited: a rejection made ahead of its handler is reported as unhandled.
    for (const work of [
      () => openApiKey('another-secret', envelope, 'doc-1'),
      () => openApiKey(SECRET, envelope, 'doc-2'),
      () => openApiKey(SECRET, envelope),
    ]) {
      const error = await rejection(work());
      expect(error).toBeInstanceOf(KeySealError);
      expect(error.message).toBe('The stored key could not be read.');
    }
  });

  it('fails on a tampered ciphertext or IV, a cut envelope and an unknown version', async () => {
    const envelope = await sealApiKey(SECRET, KEY);
    const [version, iv, sealed] = envelope.split('.') as [string, string, string];
    const bad = [
      tampered(envelope, 2),
      tampered(envelope, 1),
      `${version}.${iv}.${sealed.slice(0, -6)}`,
      `${version}.${iv.slice(0, 8)}.${sealed}`,
      `v2.${iv}.${sealed}`,
      `${version}.${iv}`,
      `${version}.${iv}.${sealed}.more`,
      `${version}..${sealed}`,
      `${version}.${iv}.!!!`,
      '',
      KEY,
    ];
    for (const one of bad) {
      const error = await rejection(openApiKey(SECRET, one));
      expect(error).toBeInstanceOf(KeySealError);
      expect(error.name).toBe('KeySealError');
      expect(error.message).not.toContain(KEY);
    }
  });

  it('never names the key or the secret in an error', async () => {
    const errors = [
      await rejection(sealApiKey('', KEY)),
      await rejection(openApiKey('', await sealApiKey(SECRET, KEY))),
      await rejection(sealApiKey(SECRET, '')),
      await rejection(sealApiKey(SECRET, `${KEY}${'x'.repeat(MAX_API_KEY_CHARS)}`)),
      await rejection(openApiKey('another-secret', await sealApiKey(SECRET, KEY))),
    ];
    expect(errors.map((e) => e.message)).toEqual([
      'The key secret is not set.',
      'The key secret is not set.',
      'That is not an API key.',
      'That is not an API key.',
      'The stored key could not be read.',
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(KeySealError);
      expect(`${error.message} ${error.stack}`).not.toContain(KEY);
      expect(`${error.message} ${error.stack}`).not.toContain(SECRET);
    }
  });
});

describe("the key's hint", () => {
  it('is the last four characters and nothing more', () => {
    expect(keyHint(KEY)).toBe('4f2a');
    expect(keyHint('short')).toBe('');
    expect(keyHint('')).toBe('');
  });
});
