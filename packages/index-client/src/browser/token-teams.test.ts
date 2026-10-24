import { describe, expect, it } from 'vitest';
import { teamsOfToken } from './token-teams';

const tokenWith = (claims: unknown) => `h.${btoa(JSON.stringify(claims))}.s`;

describe('teamsOfToken', () => {
  it("reads the teams claim's well-formed entries", () => {
    const token = tokenWith({ teams: [{ id: 't1', name: 'One' }, { id: 2 }, null] });
    expect(teamsOfToken(token)).toEqual([{ id: 't1', name: 'One' }]);
  });

  it('reads a name with any letter in it', () => {
    const json = new TextEncoder().encode(JSON.stringify({ teams: [{ id: 't1', name: 'Équipe 🎨' }] }));
    const payload = btoa(String.fromCharCode(...json))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(teamsOfToken(`h.${payload}.s`)).toEqual([{ id: 't1', name: 'Équipe 🎨' }]);
  });

  it('answers none for no token, a guest, or anything unreadable', () => {
    expect(teamsOfToken(null)).toEqual([]);
    expect(teamsOfToken(tokenWith({ kind: 'guest' }))).toEqual([]);
    expect(teamsOfToken('x.!!!.y')).toEqual([]);
  });
});
