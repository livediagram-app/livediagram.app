// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { chipWidthOf, resetChipWidths } from '../chip-widths';
import { AvatarWalker } from './AvatarWalker';

// docs/specs/008-canvas/avatar-mode.md "Seated neighbours' chips never cover each other" (Work Tracker 706): each chip
// is measured once per name and status, so the spread uses its real width.

let widthReads = 0;
beforeEach(() => {
  widthReads = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    widthReads += 1;
    return this.textContent ? this.textContent.length * 5 + 12 : 0;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetChipWidths();
  Reflect.deleteProperty(document, 'fonts');
});

const walker = (name: string | undefined, status: 'focus' | null, x = 0) => (
  <AvatarWalker
    pos={{ x, y: 0 }}
    facing="down"
    config={DEFAULT_AVATAR_CONFIG}
    walking={false}
    stepFrame={0}
    standingOn={null}
    name={name}
    status={status}
  />
);

describe('AvatarWalker chip measure', () => {
  it('measures a peer’s chip once, and your own status chip, not again for a step', () => {
    const { rerender } = render(walker('Clever Walrus', null));
    expect(chipWidthOf('Clever Walrus', null)).toBe('Clever Walrus'.length * 5 + 12);
    const reads = widthReads;
    rerender(walker('Clever Walrus', null, 40));
    rerender(walker('Clever Walrus', null, 80));
    expect(widthReads).toBe(reads);
    cleanup();
    render(walker(undefined, 'focus'));
    expect(chipWidthOf('', 'Focusing')).toBeGreaterThan(0);
  });

  it('measures again once the web fonts land', async () => {
    let land: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      land = resolve;
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { status: 'loading', ready },
    });
    render(walker('Brave Otter', null));
    const before = chipWidthOf('Brave Otter', null);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(99);
    await act(async () => {
      land();
      await ready;
    });
    expect(chipWidthOf('Brave Otter', null)).toBe(99);
    expect(before).not.toBe(99);
  });

  it('measures nothing for a character with no chip', () => {
    render(walker(undefined, null));
    expect(widthReads).toBe(0);
  });
});
