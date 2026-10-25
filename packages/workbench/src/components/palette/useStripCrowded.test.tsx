// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useStripCrowded } from './useStripCrowded';

// docs/specs/007-editor/toolbar-layout.md "The category bar": a strip too wide to centre between the menu card's
// sides sits at the right instead of running under the card.

let fire: () => void = () => {};
const MENU_RIGHT = 185;

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      fire = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const menu = document.createElement('div');
  menu.setAttribute('data-toolbar-menu', '');
  vi.spyOn(menu, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(12, 12, MENU_RIGHT - 12, 44),
  );
  document.body.append(menu);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function Strip({
  width,
  enabled = true,
  onCrowded,
}: {
  width: number;
  enabled?: boolean;
  onCrowded: (c: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  onCrowded(useStripCrowded(ref, enabled));
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => new DOMRect(0, 12, width, 50);
      }}
    />
  );
}

const at = (w: number) => {
  vi.stubGlobal('innerWidth', w);
  act(() => fire());
};

describe('useStripCrowded', () => {
  it('is crowded on a tablet, where the glyph strip is wider than the centred room', () => {
    vi.stubGlobal('innerWidth', 768);
    const seen: boolean[] = [];
    // Room: 768 less (185 + 8) on each side = 382; the strip is 425.
    render(<Strip width={425} onCrowded={(c) => seen.push(c)} />);
    expect(seen.at(-1)).toBe(true);
  });

  it('centres again once the window has room', () => {
    vi.stubGlobal('innerWidth', 768);
    const seen: boolean[] = [];
    render(<Strip width={425} onCrowded={(c) => seen.push(c)} />);
    at(1280);
    expect(seen.at(-1)).toBe(false);
  });

  it('is never crowded where it is off (a phone, whose strip sits beside the card)', () => {
    vi.stubGlobal('innerWidth', 390);
    const seen: boolean[] = [];
    render(<Strip width={425} enabled={false} onCrowded={(c) => seen.push(c)} />);
    expect(seen.every((c) => !c)).toBe(true);
  });
});
