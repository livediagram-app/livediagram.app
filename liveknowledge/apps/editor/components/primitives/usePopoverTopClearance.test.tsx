// @vitest-environment jsdom

// A popover opening up from a bottom dock button stops 8 px under a toolbar across the canvas's top that its column
// meets (docs/specs/007-editor/toolbar-layout.md "Layout details"): on a phone the strip spans the width, and the
// Vote ran up under it, its header hidden.

import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StripBox } from '@liveworkspace/workbench/components/chrome/PaletteTray';

const bars = vi.hoisted(() => ({
  strip: null as StripBox | null,
}));
vi.mock('@liveworkspace/workbench/components/chrome/PaletteTray', () => ({
  usePaletteStripBox: () => bars.strip,
}));

import { usePopoverTopClearance } from './usePopoverTopClearance';

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

// The canvas box from y 56 (under the header) down 552 px; the panel in the column x 94..382.
function Probe({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const clear = usePopoverTopClearance(ref, active);
  return (
    <div
      data-clear={clear}
      ref={(el) => {
        if (!el) return;
        (ref as { current: HTMLDivElement | null }).current = el;
        const host = el.parentElement!;
        Object.defineProperty(el, 'offsetParent', { value: host, configurable: true });
        host.getBoundingClientRect = () => rect(0, 56, 390, 552);
        el.getBoundingClientRect = () => rect(94, 68, 288, 475);
      }}
    />
  );
}

function measure(active = true): number {
  const { container } = render(
    <div>
      <Probe active={active} />
    </div>,
  );
  return Number(container.querySelector('[data-clear]')!.getAttribute('data-clear'));
}

afterEach(() => {
  cleanup();
  bars.strip = null;
});

describe('usePopoverTopClearance', () => {
  it('keeps 12 px when no toolbar is in the way', () => {
    expect(measure()).toBe(12);
  });

  it('stops 8 px under a phone strip spanning its column', () => {
    bars.strip = { left: 12, width: 366, top: 68, bottom: 114 };
    // 114 on screen is 58 into the canvas box, plus the 8 px gap.
    expect(measure()).toBe(66);
  });

  it('ignores a strip beside its column, and one at the bottom', () => {
    bars.strip = { left: 400, width: 300, top: 68, bottom: 114 };
    expect(measure()).toBe(12);
    cleanup();
    bars.strip = { left: 12, width: 366, top: 540, bottom: 586 };
    expect(measure()).toBe(12);
  });

  it('keeps 12 px while the popover is not opening upward', () => {
    bars.strip = { left: 12, width: 366, top: 68, bottom: 114 };
    expect(measure(false)).toBe(12);
  });
});
