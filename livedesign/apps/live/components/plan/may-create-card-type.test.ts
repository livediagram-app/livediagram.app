import { describe, expect, it } from 'vitest';
import { ITEM_TYPES_MAX } from '@livedesign/items';
import { mayCreateCardType } from './may-create-card-type';

describe('mayCreateCardType', () => {
  it('is an Editor’s while the catalogue has room', () => {
    expect(mayCreateCardType({ canEdit: true, types: [] })).toBe(true);
    expect(mayCreateCardType({ canEdit: true, types: Array(ITEM_TYPES_MAX).fill(0) })).toBe(false);
  });

  it('is never a Participant’s', () => {
    expect(mayCreateCardType({ canEdit: false, types: [] })).toBe(false);
  });
});
