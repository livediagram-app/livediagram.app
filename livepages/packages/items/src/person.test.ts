import { describe, expect, it } from 'vitest';
import { itemPersonId } from './person';

describe('itemPersonId', () => {
  it('is stable, 24 hex characters, and hides the owner id', async () => {
    const a = await itemPersonId('guest-123');
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(await itemPersonId('guest-123')).toBe(a);
    expect(await itemPersonId('guest-124')).not.toBe(a);
    expect(a).not.toContain('guest');
  });
});
