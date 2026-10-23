// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { itemHref, newPlanHref, shareUrl, teamsOfToken } from './explorer-host';

describe('explorer host', () => {
  it('copies a share link as the address whose page head names the plan', () => {
    const url = shareUrl({ code: 'ABCD2345', itemId: 'p1' } as never, { id: 'p1' } as never);
    expect(url).toBe(`${window.location.origin}/project/shared?s=ABCD2345`);
  });

  it('opens a plan here and another app’s item on its own site', () => {
    expect(itemHref({ id: 'p1', app: 'liveplanner', sharedVia: null } as never)).toBe(
      '/project/p1',
    );
    const elsewhere = itemHref({ id: 'd1', app: 'livediagram', sharedVia: 'CODE' } as never);
    expect(elsewhere).toMatch(/^https?:\/\//);
    expect(elsewhere.endsWith('/d1?s=CODE')).toBe(true);
  });

  it('files New where it was pressed', () => {
    expect(newPlanHref(null)).toBe('/new');
    expect(newPlanHref({ folderId: 'f1', teamId: null })).toBe('/new?folder=f1');
  });

  it('reads teams from a token, none from a guest or a bad one', () => {
    const claims = btoa(JSON.stringify({ teams: [{ id: 't1', name: 'Atlas' }, { id: 2 }] }));
    expect(teamsOfToken(`h.${claims}.s`)).toEqual([{ id: 't1', name: 'Atlas' }]);
    expect(teamsOfToken(null)).toEqual([]);
    expect(teamsOfToken('x.y.z')).toEqual([]);
  });
});
