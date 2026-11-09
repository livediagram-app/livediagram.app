import { describe, expect, it } from 'vitest';
import { claimsOf, teamsOfToken } from './token';

// A token as accounts signs it: its payload UTF-8 JSON, base64url without padding (the signature is not read here).
const tokenOf = (claims: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(claims));
  const payload = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e30.${payload}.sig`;
};

describe('reading a token', () => {
  it('reads team names beyond ASCII as they were named', () => {
    const token = tokenOf({
      sub: 'user_ada',
      teams: [
        { id: 'team_1', name: 'Équipe Café' },
        { id: 'team_2', name: 'デザイン 🎨' },
      ],
    });
    expect(teamsOfToken(token)).toEqual([
      { id: 'team_1', name: 'Équipe Café' },
      { id: 'team_2', name: 'デザイン 🎨' },
    ]);
    expect(claimsOf(token).sub).toBe('user_ada');
  });

  it('reads none from no token, a malformed one, or one without teams', () => {
    expect(teamsOfToken(null)).toEqual([]);
    expect(teamsOfToken('nope')).toEqual([]);
    expect(teamsOfToken('a.!!!.b')).toEqual([]);
    expect(teamsOfToken(tokenOf({ sub: 'guest_1' }))).toEqual([]);
    expect(teamsOfToken(tokenOf({ teams: [{ id: 7 }, { id: 'team_3', name: 'Ops' }] }))).toEqual([
      { id: 'team_3', name: 'Ops' },
    ]);
  });
});
