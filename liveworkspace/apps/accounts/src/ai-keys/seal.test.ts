// Sealing a customer's AI key (liveworkspace/docs/specs/003-accounts/ai-keys.md "Sealing").
import { describe, expect, it } from 'vitest';
import {
  AiKeySealError,
  MAX_AI_KEY_CHARS,
  aiKeyHint,
  aiKeySecrets,
  isAiKeyShaped,
  openAiKey,
  sealAiKey,
  sealedVersion,
} from './seal.ts';

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';
const V1 = aiKeySecrets({ AI_KEY_SECRET: 'first-master-secret' })!;
const V2 = aiKeySecrets({
  AI_KEY_SECRET: '2:second-master-secret',
  AI_KEY_SECRET_PREVIOUS: 'first-master-secret',
})!;

describe('the master secrets', () => {
  it('fail closed without one, and read a version from `<version>:<secret>`', () => {
    expect(aiKeySecrets({})).toBeNull();
    expect(aiKeySecrets({ AI_KEY_SECRET: '  ' })).toBeNull();
    expect(aiKeySecrets({ AI_KEY_SECRET: '0:zero is no version' })).toBeNull();
    expect(V1).toEqual({ current: { version: 1, secret: 'first-master-secret' } });
    expect(V2).toEqual({
      current: { version: 2, secret: 'second-master-secret' },
      previous: { version: 1, secret: 'first-master-secret' },
    });
    // A previous secret of the same version is no rotation.
    expect(aiKeySecrets({ AI_KEY_SECRET: '1:a', AI_KEY_SECRET_PREVIOUS: '1:b' })).toEqual({
      current: { version: 1, secret: 'a' },
    });
  });
});

describe('what may be sealed and shown', () => {
  it('takes a key-shaped string only, and shows four characters of a long one', () => {
    expect(isAiKeyShaped(KEY)).toBe(true);
    for (const bad of [
      '',
      'has space',
      'tab\there',
      'nul\u0000',
      'x'.repeat(MAX_AI_KEY_CHARS + 1),
      42,
      null,
    ]) {
      expect(isAiKeyShaped(bad)).toBe(false);
    }
    expect(aiKeyHint(KEY)).toBe('4f2a');
    expect(aiKeyHint('short-key')).toBe('');
  });
});

describe('sealing and opening', () => {
  it('opens for its own owner and provider, and never holds the key in the clear', async () => {
    const { sealed, version } = await sealAiKey(V1, 'account:user_ada', 'anthropic', KEY);
    expect(version).toBe(1);
    expect(sealedVersion(sealed)).toBe(1);
    expect(sealed).not.toContain(KEY);
    expect(sealed).not.toContain('4f2a');
    expect(await openAiKey(V1, 'account:user_ada', 'anthropic', sealed)).toBe(KEY);
    // A fresh salt and IV each time: the same key seals differently.
    expect((await sealAiKey(V1, 'account:user_ada', 'anthropic', KEY)).sealed).not.toBe(sealed);
  });

  it('refuses to seal what is no key', async () => {
    await expect(sealAiKey(V1, 'account:user_ada', 'openai', 'two words')).rejects.toThrow(
      AiKeySealError,
    );
  });

  it('does not open moved to another owner, relabelled to the other provider, or under another secret', async () => {
    const { sealed } = await sealAiKey(V1, 'team:team_1', 'openai', KEY);
    const refusals = [
      openAiKey(V1, 'team:team_2', 'openai', sealed),
      openAiKey(V1, 'account:team_1', 'openai', sealed),
      openAiKey(V1, 'team:team_1', 'anthropic', sealed),
      openAiKey(
        aiKeySecrets({ AI_KEY_SECRET: 'another-secret' })!,
        'team:team_1',
        'openai',
        sealed,
      ),
      // Relabelled to another version: the version is in the derivation and the additional data.
      openAiKey(
        aiKeySecrets({ AI_KEY_SECRET: '2:first-master-secret' })!,
        'team:team_1',
        'openai',
        sealed.replace(/^1\./, '2.'),
      ),
    ];
    for (const refused of refusals) {
      const error = await refused.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AiKeySealError);
      expect(String((error as Error).message)).not.toContain(KEY);
    }
  });

  it('fails closed on any envelope changed or cut, with one message that holds nothing of it', async () => {
    const { sealed } = await sealAiKey(V1, 'account:user_ada', 'anthropic', KEY);
    const [v, salt, iv, ct] = sealed.split('.') as [string, string, string, string];
    const flip = (text: string) => (text[0] === 'A' ? 'B' : 'A') + text.slice(1);
    for (const broken of [
      '',
      'not-an-envelope',
      `${v}.${salt}.${iv}`,
      `${v}.${salt}.${iv}.${ct}.extra`,
      `01.${salt}.${iv}.${ct}`,
      `x.${salt}.${iv}.${ct}`,
      `${v}.${flip(salt)}.${iv}.${ct}`,
      `${v}.${salt}.${flip(iv)}.${ct}`,
      `${v}.${salt}.${iv}.${flip(ct)}`,
      `${v}.${salt.slice(2)}.${iv}.${ct}`,
      `${v}.${salt}.${iv.slice(2)}.${ct}`,
      `${v}.${salt}.${iv}.${ct.slice(0, -4)}`,
      `${v}.!!!.${iv}.${ct}`,
    ]) {
      const error = await openAiKey(V1, 'account:user_ada', 'anthropic', broken).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(AiKeySealError);
      expect((error as Error).message).toBe('The stored key could not be read.');
    }
    expect(sealedVersion('x.y')).toBeNull();
  });

  it('opens an old record under the previous secret while a rotation runs, and seals new ones under the current', async () => {
    const old = await sealAiKey(V1, 'account:user_ada', 'anthropic', KEY);
    expect(await openAiKey(V2, 'account:user_ada', 'anthropic', old.sealed)).toBe(KEY);
    const next = await sealAiKey(V2, 'account:user_ada', 'anthropic', KEY);
    expect(next.version).toBe(2);
    await expect(openAiKey(V1, 'account:user_ada', 'anthropic', next.sealed)).rejects.toThrow(
      AiKeySealError,
    );
  });
});
