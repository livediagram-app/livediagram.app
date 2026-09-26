import { describe, expect, it } from 'vitest';
import {
  DOUBLE_PRESS_MS,
  DOUBLE_PRESS_SLOP_PX,
  createPressLedger,
  isEchoPress,
  pairsWith,
  type ElementPress,
} from './double-press';

const press = (over: Partial<ElementPress> = {}): ElementPress => ({
  id: 'a',
  t: 1000,
  x: 100,
  y: 100,
  wasSelected: false,
  ...over,
});

describe('pairsWith', () => {
  it('pairs a quick second press on the same element', () => {
    expect(pairsWith(press(), press({ t: 1200 }))).toBe(true);
  });

  it('does not pair after the window', () => {
    expect(pairsWith(press(), press({ t: 1000 + DOUBLE_PRESS_MS + 1 }))).toBe(false);
  });

  it('does not pair across elements', () => {
    expect(pairsWith(press(), press({ id: 'b', t: 1100 }))).toBe(false);
  });

  it('does not pair presses far apart on screen', () => {
    expect(pairsWith(press(), press({ t: 1100, x: 100 + DOUBLE_PRESS_SLOP_PX + 1 }))).toBe(false);
  });

  it('does not pair with nothing', () => {
    expect(pairsWith(null, press())).toBe(false);
  });
});

describe('isEchoPress', () => {
  it('is an echo when the first press found the element unselected', () => {
    expect(isEchoPress(press(), press({ t: 1100 }))).toBe(true);
  });

  it('is not an echo when the handles were already showing', () => {
    expect(isEchoPress(press({ wasSelected: true }), press({ t: 1100 }))).toBe(false);
  });
});

describe('createPressLedger', () => {
  it('pairs a press with the one recorded before it, then records it', () => {
    const ledger = createPressLedger();
    expect(ledger.press(press())).toEqual({ pairs: false, echo: false });
    expect(ledger.press(press({ t: 1100, wasSelected: true }))).toEqual({
      pairs: true,
      echo: true,
    });
  });

  it('never pairs a third press with the second, so a triple is not two doubles', () => {
    const ledger = createPressLedger();
    ledger.press(press());
    ledger.press(press({ t: 1100 }));
    expect(ledger.press(press({ t: 1200 })).pairs).toBe(false);
  });

  it('peeks without recording', () => {
    const ledger = createPressLedger();
    ledger.press(press());
    expect(ledger.peek(press({ t: 1100 })).echo).toBe(true);
    expect(ledger.press(press({ t: 1150 })).pairs).toBe(true);
  });
});
