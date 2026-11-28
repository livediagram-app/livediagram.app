// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnchoredPopover } from './AnchoredPopover';

// The room inside the panel as a CSS variable (`--anchored-room`), so content that sizes itself to fit (the footer's
// Tools and its views, footer-tools-menu.md "Tools fits the window") never grows past the panel and scrolls it.
afterEach(cleanup);

function open(pointer: boolean) {
  // An anchor at the foot of a 720 px window, as the footer's Tools button sits.
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () =>
    ({ left: 1000, right: 1080, top: 680, bottom: 712, width: 80, height: 32 }) as DOMRect;
  document.body.appendChild(anchor);
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
  render(
    <AnchoredPopover anchor={anchor} name="Tools" width={480} pointer={pointer} onClose={() => {}}>
      <p>Body</p>
    </AnchoredPopover>,
  );
  return document.querySelector<HTMLElement>('[data-anchored-popover]')!;
}

describe('AnchoredPopover room', () => {
  it('names the room inside it, less a pointer’s border', () => {
    const panel = open(true);
    const max = parseFloat(panel.style.maxHeight);
    expect(max).toBeGreaterThan(0);
    expect(panel.style.getPropertyValue('--anchored-room')).toBe(`${max - 2}px`);
  });

  it('is the whole room without a pointer', () => {
    const panel = open(false);
    expect(panel.style.getPropertyValue('--anchored-room')).toBe(panel.style.maxHeight);
  });
});
