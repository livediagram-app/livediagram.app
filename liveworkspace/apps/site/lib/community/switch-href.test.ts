import { describe, expect, it } from 'vitest';
import { SITES } from '@liveworkspace/sites';
import { communitySwitchHref } from './switch-href';

describe("the Community page's site switcher", () => {
  it('leads each site to its own Community', () => {
    const href = (id: string) => communitySwitchHref(SITES.find((s) => s.id === id)!);
    expect(href('liveworkspace.app')).toBe('https://www.liveworkspace.app/community');
    expect(href('livediagram.app')).toBe('https://www.livediagram.app/community');
    expect(href('liveplanner.app')).toBe('https://www.liveplanner.app/community');
  });
});
