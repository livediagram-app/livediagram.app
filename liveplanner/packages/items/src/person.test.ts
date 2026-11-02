import { describe, expect, it } from 'vitest';
import { isIdentityPersonId, itemPersonId } from './person';

describe('isIdentityPersonId', () => {
  it('knows a hashed person id from a custom or an example one', async () => {
    expect(isIdentityPersonId(await itemPersonId('user_1'))).toBe(true);
    expect(isIdentityPersonId('n-casey')).toBe(false);
    expect(isIdentityPersonId('example-maya')).toBe(false);
    expect(isIdentityPersonId('ABCDEF0123456789abcdef01')).toBe(false);
  });
});

describe('itemPersonId', () => {
  it('is stable, 24 hex characters, and hides the owner id', async () => {
    const a = await itemPersonId('guest-123');
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(await itemPersonId('guest-123')).toBe(a);
    expect(await itemPersonId('guest-124')).not.toBe(a);
    expect(a).not.toContain('guest');
  });
});
