import { describe, expect, it } from 'vitest';
import { cutText } from './text-cut';
import { CARD_TAG_MAX, clampCardTag } from './card';
import { COMPONENT_NAME_MAX, clampComponentName } from './components';
import { SANKEY_NAME_MAX, cleanSankeyName } from './sankey-model';
import { pageRenamed } from './pages-edits';
import { PAGE_NAME_MAX, pagesOf } from './page';

// A lone surrogate: half an emoji, left by a cut through its pair.
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('cutText', () => {
  it('cuts at the cap, one short where the cap falls inside an emoji', () => {
    expect(cutText('abcdef', 4)).toBe('abcd');
    expect(cutText('abc', 4)).toBe('abc');
    // '😀' is two UTF-16 units: a cap of 4 lands between them.
    expect(cutText('abc😀', 4)).toBe('abc');
    expect(cutText('abc😀', 5)).toBe('abc😀');
    expect(cutText('😀😀', 1)).toBe('');
    expect(cutText('abc', 0)).toBe('');
  });

  it('keeps every capped name whole at its cap', () => {
    const over = (max: number) => `${'a'.repeat(max - 1)}😀 more`;
    expect(clampCardTag(over(CARD_TAG_MAX))).not.toMatch(LONE);
    expect(clampCardTag(over(CARD_TAG_MAX))).toBe('a'.repeat(CARD_TAG_MAX - 1));
    expect(clampComponentName(over(COMPONENT_NAME_MAX))).not.toMatch(LONE);
    expect(cleanSankeyName(over(SANKEY_NAME_MAX))).not.toMatch(LONE);
    const tab = { elements: [], pages: [{ id: 'p1', orientation: 'portrait' as const }] };
    const renamed = pageRenamed(tab, 'p1', over(PAGE_NAME_MAX));
    if (!('tab' in renamed)) throw new Error('refused');
    expect(pagesOf(renamed.tab)[0]!.name).toBe('a'.repeat(PAGE_NAME_MAX - 1));
  });
});
