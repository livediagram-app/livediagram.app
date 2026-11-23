import { describe, expect, it } from 'vitest';
import { GUEST_LIMITS, guestLimit, itemPayer, itemPayerScope } from './item-payer';
import { limitsFor } from './tiers';

describe('who pays for an item', () => {
  it("is the team for a team's item, whoever made it", () => {
    expect(itemPayer({ owner: 'user_ada', team: 'team_1' })).toEqual({
      kind: 'owner',
      scope: 't:team_1',
    });
    expect(itemPayer({ owner: 'guest_1', team: 'team_1' })).toEqual({
      kind: 'owner',
      scope: 't:team_1',
    });
    expect(itemPayerScope({ team: 'team_1' })).toBe('t:team_1');
  });

  it("is the person for a signed-in person's item", () => {
    expect(itemPayer({ owner: 'user_ada', team: null })).toEqual({
      kind: 'owner',
      scope: 'p:user_ada',
    });
    expect(itemPayerScope({ owner: 'user_ada' })).toBe('p:user_ada');
  });

  it('is never a scope for a guest, so no fresh guest id gets an allowance of its own', () => {
    for (const owner of ['guest_abc', 'guest_', 'ada', 'link:abc', 'USER_ada']) {
      expect(itemPayer({ owner, team: null })).toEqual({ kind: 'guest' });
      expect(itemPayerScope({ owner })).toBeNull();
    }
  });

  it('is nobody for a head that names no owner, or one no scope can hold', () => {
    for (const head of [{}, { owner: null, team: null }, { owner: '', team: '' }]) {
      expect(itemPayer(head)).toEqual({ kind: 'nobody' });
      expect(itemPayerScope(head)).toBeNull();
    }
    expect(itemPayer({ owner: 'user_a b' })).toEqual({ kind: 'nobody' });
    expect(itemPayer({ team: 'a b' })).toEqual({ kind: 'nobody' });
  });

  it("gives a guest's item Free's limits", () => {
    expect(GUEST_LIMITS).toEqual(limitsFor('free'));
    expect(guestLimit('callMinutesPerMonth')).toBe(limitsFor('free').callMinutesPerMonth);
  });
});
