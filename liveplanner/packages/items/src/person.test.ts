import { describe, expect, it } from 'vitest';
import { isIdentityPersonId, itemPersonId, teamMemberPersonOf } from './person';

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

describe('teamMemberPersonOf', () => {
  const colour = (name: string) => `c-${name}`;
  const member = { userId: 'user_1', email: 'sam@example.com', name: 'Sam Lee', status: 'joined' };

  it('names a joined member as items do, coloured by the rule given', async () => {
    expect(await teamMemberPersonOf(member, colour)).toEqual({
      id: await itemPersonId('user_1'),
      name: 'Sam Lee',
      color: 'c-Sam Lee',
    });
  });

  it('falls back to the address, and leaves out invites, the account-less and the nameless', async () => {
    expect((await teamMemberPersonOf({ ...member, name: null }, colour))?.name).toBe('sam');
    expect(await teamMemberPersonOf({ ...member, status: 'invited' }, colour)).toBeNull();
    expect(await teamMemberPersonOf({ ...member, userId: null }, colour)).toBeNull();
    expect(await teamMemberPersonOf({ ...member, name: null, email: null }, colour)).toBeNull();
  });
});
