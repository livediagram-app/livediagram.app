// docs/specs/031-photo/photo-adjustments.md "The Adjust tab": the tiles in their sections, each drawn changing the
// photo.
import { describe, expect, it } from 'vitest';
import { adjustmentForm, ADJUSTMENTS, LAYER_ADJUSTMENT_IDS } from '@livedesign/photo-engine';
import { ADJUST_SECTIONS, ADJUST_SHOWCASE } from './adjust-showcase';

describe('the Adjust tab tiles', () => {
  it('hold every adjustment a layer may take, once each', () => {
    const listed = ADJUST_SECTIONS.flatMap((s) => s.ids);
    expect([...listed].sort()).toEqual([...LAYER_ADJUSTMENT_IDS].sort());
  });
  it('draw each one with settings that change the photo', () => {
    for (const id of LAYER_ADJUSTMENT_IDS) {
      const form = adjustmentForm({ id, params: ADJUST_SHOWCASE[id] ?? ADJUSTMENTS[id].defaults });
      expect(form.kind, id).not.toBe('identity');
    }
  });
});
