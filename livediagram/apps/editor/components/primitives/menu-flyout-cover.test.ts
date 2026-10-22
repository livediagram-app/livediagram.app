import { describe, expect, it } from 'vitest';
import { coverHost } from './menu-flyout-cover';

// A section's flyout on a phone covers the menu that opened it
// (docs/specs/004-interface-design/flyout-height-stability.md "On a phone it covers the parent").

const PHONE = { width: 390, height: 664 };
const MARGIN = 8;

describe('coverHost', () => {
  it('takes an edge-to-edge sheet’s own left and width, flush with the screen', () => {
    const sheet = { left: 0, top: 386.6, width: 390, height: 277.4 };
    expect(coverHost(sheet, 200, PHONE, MARGIN)).toMatchObject({ left: 0, width: 390 });
  });

  it('takes a floating menu’s left and width as they are', () => {
    const menu = { left: 24.4, top: 120, width: 224, height: 300 };
    expect(coverHost(menu, 200, PHONE, MARGIN)).toEqual({
      left: 24,
      top: 120,
      width: 224,
      minHeight: 300,
    });
  });

  it('keeps a host wider than the screen, or past its edge, on screen', () => {
    expect(
      coverHost({ left: -10, top: 100, width: 420, height: 200 }, 100, PHONE, MARGIN),
    ).toMatchObject({ left: 0, width: 390 });
    expect(
      coverHost({ left: 300, top: 100, width: 224, height: 200 }, 100, PHONE, MARGIN),
    ).toMatchObject({ left: 166, width: 224 });
  });

  it('pulls a child taller than the room below up just enough to fit, and covers the host’s height', () => {
    const sheet = { left: 0, top: 386.6, width: 390, height: 277.4 };
    expect(coverHost(sheet, 443, PHONE, MARGIN)).toEqual({
      left: 0,
      top: 213,
      width: 390,
      minHeight: 277,
    });
  });

  it('never covers more height than the screen leaves below its top', () => {
    const tall = { left: 0, top: 40, width: 390, height: 900 };
    expect(coverHost(tall, 100, PHONE, MARGIN)).toMatchObject({ top: 40, minHeight: 616 });
  });
});
