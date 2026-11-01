import { describe, expect, it } from 'vitest';
import { importSealKey, seal, sealKeyBytes, unseal } from './sealed';

// Base64 of the bytes 1 to 32, and of 32 other bytes.
const SECRET = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=';
const OTHER = 'ISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0A=';

describe('the key', () => {
  it('takes 32 bytes of base64 or base64url, trimmed', () => {
    expect(sealKeyBytes(SECRET)?.length).toBe(32);
    expect(sealKeyBytes(` ${SECRET}\n`)?.length).toBe(32);
    expect(sealKeyBytes(SECRET.replace(/=+$/, ''))?.length).toBe(32);
  });

  it('refuses nothing, the wrong length and junk', async () => {
    expect(sealKeyBytes(undefined)).toBeNull();
    expect(sealKeyBytes('')).toBeNull();
    expect(sealKeyBytes('AQID')).toBeNull();
    expect(sealKeyBytes('not base64 at all!')).toBeNull();
    expect(await importSealKey('AQID')).toBeNull();
    expect(await importSealKey(SECRET)).not.toBeNull();
  });
});

describe('sealing', () => {
  it('opens what it sealed, with a fresh IV each time', async () => {
    const key = (await importSealKey(SECRET))!;
    const a = await seal(key, 'w1:url', 'https://hooks.example.com/in');
    const b = await seal(key, 'w1:url', 'https://hooks.example.com/in');
    expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
    expect(a).not.toBe(b);
    expect(await unseal(key, 'w1:url', a)).toBe('https://hooks.example.com/in');
  });

  it('opens nothing under another context, another key, or tampered with', async () => {
    const key = (await importSealKey(SECRET))!;
    const other = (await importSealKey(OTHER))!;
    const sealed = await seal(key, 'w1:secret', 'whsec_abc');
    expect(await unseal(key, 'w2:secret', sealed)).toBeNull();
    expect(await unseal(other, 'w1:secret', sealed)).toBeNull();
    const [v, iv, body] = sealed.split('.');
    const flipped = body!.startsWith('A') ? `B${body!.slice(1)}` : `A${body!.slice(1)}`;
    expect(await unseal(key, 'w1:secret', `${v}.${iv}.${flipped}`)).toBeNull();
  });

  it.each([
    ['another version', (s: string) => s.replace(/^v1/, 'v2')],
    ['no body', (s: string) => s.split('.').slice(0, 2).join('.')],
    ['no IV', (s: string) => `v1..${s.split('.')[2]}`],
    ['a short IV', (s: string) => `v1.AQID.${s.split('.')[2]}`],
    ['an IV that is not base64', (s: string) => `v1.!!!!.${s.split('.')[2]}`],
    ['a body that is not base64', (s: string) => `v1.${s.split('.')[1]}.!!!!`],
  ])('refuses %s', async (_, mangle) => {
    const key = (await importSealKey(SECRET))!;
    const sealed = await seal(key, 'c', 'plain');
    expect(await unseal(key, 'c', mangle(sealed))).toBeNull();
  });
});
