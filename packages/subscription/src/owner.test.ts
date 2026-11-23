import { describe, expect, it } from 'vitest';
import { isOwnerScope, ownerScopeOf, parseOwnerScope, personScope, teamScope } from './owner';

describe('an owner', () => {
  it('is written as the index writes a scope', () => {
    expect(personScope('user_ada')).toBe('p:user_ada');
    expect(teamScope('team_1')).toBe('t:team_1');
  });

  it("is an item's team when it has one, otherwise the person who owns it", () => {
    expect(ownerScopeOf('user_ada', 'team_1')).toBe('t:team_1');
    expect(ownerScopeOf('user_ada', null)).toBe('p:user_ada');
    expect(ownerScopeOf('user_ada', undefined)).toBe('p:user_ada');
    expect(ownerScopeOf('user_ada', '')).toBe('p:user_ada');
  });

  it('parses to its kind and id', () => {
    expect(parseOwnerScope('p:user_ada')).toEqual({ kind: 'person', id: 'user_ada' });
    expect(parseOwnerScope('t:0b7a2b6e-3f1c')).toEqual({ kind: 'team', id: '0b7a2b6e-3f1c' });
    expect(parseOwnerScope(`p:${'a'.repeat(128)}`)).not.toBeNull();
  });

  it('is nothing else', () => {
    for (const value of [
      '',
      'p:',
      't:',
      'x:user_ada',
      'user_ada',
      'p:a b',
      'p:a/b',
      'p:a:b',
      'P:user_ada',
      `p:${'a'.repeat(129)}`,
      null,
      undefined,
      7,
      {},
    ]) {
      expect(parseOwnerScope(value)).toBeNull();
      expect(isOwnerScope(value)).toBe(false);
    }
    expect(isOwnerScope('t:team_1')).toBe(true);
  });
});
