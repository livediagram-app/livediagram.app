import { describe, expect, it } from 'vitest';
import { ALIGN_ITEMS, TEXT_ALIGN } from './label-align';

describe('label alignment', () => {
  it('lays a label out as its alignment says', () => {
    expect(ALIGN_ITEMS).toEqual({ top: 'flex-start', middle: 'center', bottom: 'flex-end' });
    expect(TEXT_ALIGN).toEqual({ left: 'left', center: 'center', right: 'right' });
  });
});
