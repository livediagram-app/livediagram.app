import { describe, expect, it } from 'vitest';
import {
  CARD_HOLD_TO_DRAG_MS,
  PHONE_END_CLEARANCE,
  boardLook,
  holdPhase,
  shownQuick,
  type BoardPlace,
} from './phone-board';

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
      cardTouch: 'touch-none',
      holdToDrag: false,
      snap: false,
      overscroll: '',
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
    const look = boardLook(place({ covering: true }), 'minimal');
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

  it('keeps a phone board scroll to itself: all of it covering, only sideways in a Dashboard slot', () => {
    expect(boardLook(place({ phone: true, covering: true }), undefined).overscroll).toBe(
      'overscroll-contain',
    );
    expect(boardLook(place({ phone: true, inSlot: true }), undefined).overscroll).toBe(
      'overscroll-x-contain',
    );
    expect(boardLook(place({ covering: true }), undefined).overscroll).toBe('');
  });

  it('lets a finger on a phone board card scroll, the card picked up by a hold, and only there', () => {
    expect(boardLook(place({ phone: true, covering: true }), undefined)).toMatchObject({
      cardTouch: 'touch-pan-x touch-pan-y',
      holdToDrag: true,
    });
    for (const where of [
      { phone: true },
      { covering: true },
      { phone: true, covering: true, interactive: false },
    ]) {
      expect(boardLook(place(where), undefined)).toMatchObject({
        cardTouch: 'touch-none',
        holdToDrag: false,
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

describe('holdPhase', () => {
  it('waits while the finger holds still, then carries once the hold is up', () => {
    expect(holdPhase(CARD_HOLD_TO_DRAG_MS, 100, false)).toBe('wait');
    expect(holdPhase(CARD_HOLD_TO_DRAG_MS, CARD_HOLD_TO_DRAG_MS, true)).toBe('carry');
  });

  it('takes a finger that moves before the hold is up as a scroll', () => {
    expect(holdPhase(CARD_HOLD_TO_DRAG_MS, 100, true)).toBe('scroll');
  });

  it('holds for less than the long press that opens the menu', () => {
    expect(CARD_HOLD_TO_DRAG_MS).toBeLessThan(500);
  });
});
