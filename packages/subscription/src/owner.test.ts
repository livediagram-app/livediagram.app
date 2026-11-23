import { describe, expect, it } from 'vitest';
import { isOwnerScope, paidTierOf, parseOwnerScope, personScope, teamScope } from './owner';

describe('an owner', () => {
  it('is written as the index writes a scope', () => {
    expect(personScope('user_ada')).toBe('p:user_ada');
    expect(teamScope('team_1')).toBe('t:team_1');
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

  it('pays for Pro for Teams as a team, and Pro as anyone else', () => {
    expect(paidTierOf('t:team_1')).toBe('team');
    expect(paidTierOf('p:user_ada')).toBe('pro');
    expect(paidTierOf({ kind: 'team', id: 'team_1' })).toBe('team');
    expect(paidTierOf({ kind: 'person', id: 'user_ada' })).toBe('pro');
    for (const value of ['', 't:', 'team_1', null, undefined])
      expect(paidTierOf(value)).toBe('pro');
  });
});
