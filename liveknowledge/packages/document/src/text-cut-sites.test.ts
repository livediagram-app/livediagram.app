import { describe, expect, it } from 'vitest';
import { CARD_TAG_MAX, clampCardTag } from './card';
import { SANKEY_NAME_MAX, cleanSankeyName } from './sankey-model';
import { pageRenamed } from './pages-edits';
import { PAGE_NAME_MAX, pagesOf } from './page';

// Capped names are cut by the shared cutText (@liveworkspace/model-core/text-cut): a plain `slice` at the cap left half
// an emoji (a lone surrogate), drawn as a replacement box and stored as U+FFFD.
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const over = (max: number) => `${'a'.repeat(max - 1)}😀 more`;

describe('capped names', () => {
  it('never keep half an emoji at the cap', () => {
    expect(clampCardTag(over(CARD_TAG_MAX))).toBe('a'.repeat(CARD_TAG_MAX - 1));
    expect(cleanSankeyName(over(SANKEY_NAME_MAX))).not.toMatch(LONE);
    const tab = { elements: [], pages: [{ id: 'p1', orientation: 'portrait' as const }] };
    const renamed = pageRenamed(tab, 'p1', over(PAGE_NAME_MAX));
    if (!('tab' in renamed)) throw new Error('refused');
    expect(pagesOf(renamed.tab)[0]!.name).toBe('a'.repeat(PAGE_NAME_MAX - 1));
  });
});
