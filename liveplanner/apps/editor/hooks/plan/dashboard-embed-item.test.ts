import { describe, expect, it } from 'vitest';
import { EMBED_FILE_CHOICE, dashboardItemOf } from './dashboard-drop';
import { contentFitKind, fitKindOf, fitsSlot } from './slot-fit';
import {
  PHONE_EMBED_MIN_PX,
  phoneSlotSize,
  phoneSlotStyle,
} from '@/components/plan/dashboard/condense';
import { forgetEmbedPlaced, markEmbedPlaced, wasEmbedPlaced } from '@/lib/embed-open-store';

// docs/specs/013-workspace/embeds.md "Embed File on a Dashboard"; docs/specs/026-plan/plan-tabs.md "On a phone".
describe('Embed File as a Dashboard item', () => {
  it('is what the Embed File tile stands for', () => {
    expect(dashboardItemOf('plan-view', EMBED_FILE_CHOICE)).toEqual({ kind: 'embed' });
  });

  it('needs a chart’s room, in a slot and as content', () => {
    expect(fitKindOf({ kind: 'embed' })).toBe('chart');
    expect(contentFitKind({ type: 'embed' }, new Map())).toBe('chart');
    expect(fitsSlot({ kind: 'embed' }, { width: 120, height: 120 })).toBe(false);
    expect(fitsSlot({ kind: 'embed' }, { width: 600, height: 400 })).toBe(true);
  });

  it('stacks on a phone at 4:3 of the width, never under its least height', () => {
    expect(phoneSlotSize({ type: 'embed' })).toBe('embed');
    expect(phoneSlotStyle('embed')).toMatchObject({
      aspectRatio: '4 / 3',
      minHeight: PHONE_EMBED_MIN_PX,
    });
    expect(PHONE_EMBED_MIN_PX).toBe(240);
  });

  it('opens Embed File once for the slot this person placed', () => {
    expect(wasEmbedPlaced('x')).toBe(false);
    markEmbedPlaced('x');
    markEmbedPlaced('x');
    expect(wasEmbedPlaced('x')).toBe(true);
    forgetEmbedPlaced('x');
    expect(wasEmbedPlaced('x')).toBe(false);
  });
});
