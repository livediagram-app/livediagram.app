// A lane title's frame (docs/specs/009-elements/lane.md "A title wraps in its gutter", Work Tracker 444).
import { describe, expect, it } from 'vitest';
import { LANE_TITLE_MAX_LINES, uprightTitleStrip } from '@livediagram/document';
import { laneTitleFrame } from './lane-title-frame';

const lane = { width: 900, height: 200 };

describe('laneTitleFrame', () => {
  it('lays an across title out in its side gutter, clamped to three lines', () => {
    const frame = laneTitleFrame({ ...lane, textAlignX: 'left' }, null, false);
    expect(frame?.style).toMatchObject({ left: 0, top: 0, width: 132, height: 200 });
    expect(frame?.className).toBe(`[&>div>div]:line-clamp-${LANE_TITLE_MAX_LINES}`);
  });

  it('follows the gutter to the right and to a seam someone dragged', () => {
    const frame = laneTitleFrame({ ...lane, textAlignX: 'right', headerSize: 180 }, null, false);
    expect(frame?.style).toMatchObject({ left: 720, width: 180 });
  });

  it('never clamps the editor, so every word stays reachable while typing', () => {
    expect(laneTitleFrame({ ...lane, textAlignX: 'left' }, null, true)?.className).toBeUndefined();
  });

  it('leaves a band title the lane’s width', () => {
    expect(laneTitleFrame({ ...lane, textAlignX: 'center', textAlignY: 'top' }, null, false)).toBe(
      null,
    );
  });

  it('turns an upright title in its strip, unclamped as before', () => {
    const el = { ...lane, textAlignX: 'left' as const, titleOrientation: 'upright' as const };
    const frame = laneTitleFrame(el, uprightTitleStrip(el, el.width, el.height), false);
    expect(frame?.style.transform).toBe('rotate(-90deg)');
    expect(frame?.className).toBeUndefined();
  });
});
