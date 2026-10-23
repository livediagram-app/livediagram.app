import { describe, expect, it } from 'vitest';
import { EXPLORER_ON_LIVEWORKSPACE, explorerHref, explorerRedirectUrl } from './explorer-redirect';

describe("livedesign's Explorer address", () => {
  it('opens each view at the same place, with its query', () => {
    const base = EXPLORER_ON_LIVEWORKSPACE ? 'https://liveworkspace.app/explorer' : '/explorer';
    expect(explorerHref()).toMatch(new RegExp(`^${base.replace(/[./]/g, '\\$&')}`));
    if (!EXPLORER_ON_LIVEWORKSPACE) {
      expect(explorerHref()).toBe('/explorer');
      expect(explorerHref('trash')).toBe('/explorer/trash');
      expect(explorerHref('/folder/', '?id=f1')).toBe('/explorer/folder?id=f1');
    }
  });

  it('names livedesign when it sends an old address to liveworkspace.app', () => {
    expect(explorerRedirectUrl('/explorer/team', '?id=t1', '#x')).toBe(
      'https://liveworkspace.app/explorer/team?id=t1&from=livedesign#x',
    );
  });
});
