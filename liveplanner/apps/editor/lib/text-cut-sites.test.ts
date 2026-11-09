import { describe, expect, it } from 'vitest';
import { PLAN_TITLE_MAX } from '@liveplanner/items';
import { COLUMN_NAME_MAX, columnName } from '@/components/plan/board-setup-edits';
import { boardTitleForTab } from './tab-named-plan';

// Capped names are cut by the shared cutText (@liveworkspace/model-core/text-cut): a plain `slice` at the cap left half
// an emoji (a lone surrogate), drawn as a replacement box and stored as U+FFFD.
const over = (max: number) => `${'a'.repeat(max - 1)}😀 more`;

describe('capped board names in the editor', () => {
  it('never keep half an emoji at the cap', () => {
    expect(columnName(over(COLUMN_NAME_MAX))).toHaveLength(COLUMN_NAME_MAX - 1);
    expect(boardTitleForTab(over(PLAN_TITLE_MAX), 'Board')).toBe('a'.repeat(PLAN_TITLE_MAX - 1));
  });
});
