import { describe, expect, it } from 'vitest';
import { PHONE_END_CLEARANCE, boardLook, shownQuick, type BoardPlace } from './phone-board';

// docs/specs/026-plan/plan-board.md "On a phone", "Maximised board".
const place = (over: Partial<BoardPlace>): BoardPlace => ({
  phone: false,
  covering: false,
  inSlot: false,
  interactive: true,
  dragging: false,
  ...over,
});

describe('boardLook', () => {
  it('leaves a desktop canvas board as it is: its own card size, widgets, the canvas panning past it', () => {
    expect(boardLook(place({}), 'detailed')).toEqual({
      columns: 'canvas',
      cardSize: 'detailed',
      widgets: true,
      container: false,
      touch: 'touch-none',
      snap: false,
      endClearance: '',
    });
  });

  it('lets a covering phone board scroll its last cards clear of the bottom controls, and only that', () => {
    expect(boardLook(place({ phone: true, covering: true }), undefined).endClearance).toBe(
      PHONE_END_CLEARANCE,
    );
    expect(boardLook(place({ phone: true, inSlot: true }), undefined).endClearance).toBe('');
    expect(boardLook(place({ covering: true }), undefined).endClearance).toBe('');
  });

  it('gives a covering desktop board five slots and a body that scrolls under a finger', () => {
    const look = boardLook(place({ covering: true }), 'compact');
    expect(look).toMatchObject({ columns: 'maximised', container: true, snap: false });
    expect(look.touch).toBe('touch-pan-x touch-pan-y');
  });

  it('lets a desktop Dashboard slot scroll under a finger, keeping its shared columns', () => {
    const look = boardLook(place({ inSlot: true }), undefined);
    expect(look).toMatchObject({ columns: 'canvas', container: false });
    expect(look.touch).toBe('touch-pan-x touch-pan-y');
  });

  it('draws Minimal cards and no widgets on a phone, even on the canvas', () => {
    expect(boardLook(place({ phone: true }), 'detailed')).toMatchObject({
      columns: 'canvas',
      cardSize: 'minimal',
      widgets: false,
      touch: 'touch-none',
    });
  });

  it('shows one column a screen, snapping, on a phone board that scrolls on its own', () => {
    for (const where of [{ covering: true }, { inSlot: true }]) {
      expect(boardLook(place({ phone: true, ...where }), undefined)).toMatchObject({
        columns: 'phone',
        container: true,
        snap: true,
        touch: 'touch-pan-x touch-pan-y',
      });
    }
  });

  it('stops snapping while a card is carried, so the edge scroll moves the columns freely', () => {
    expect(boardLook(place({ phone: true, covering: true, dragging: true }), undefined).snap).toBe(
      false,
    );
  });

  it('takes no touch-action outside Plan mode', () => {
    expect(boardLook(place({ interactive: false, inSlot: true }), undefined).touch).toBe('');
  });
});

describe('shownQuick', () => {
  it('drops the quick filter on a phone, whose widgets that set it are hidden', () => {
    const quick = { text: 'bug', mine: 'me' };
    expect(shownQuick(quick, false)).toBe(quick);
    expect(shownQuick(quick, true)).toEqual({});
  });
});
