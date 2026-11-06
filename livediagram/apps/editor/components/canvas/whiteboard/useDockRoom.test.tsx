// @vitest-environment jsdom

// The room the whiteboard dock may take, from its probe (docs/specs/023-draw-mode/draw-mode.md "When
// the bar is too wide"): in dock px, followed as the probe resizes, null until measured or on a phone.
import { useRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDockRoom } from './useDockRoom';

let width = 0;

function Probe({
  active,
  scale = 1,
  onValue,
}: {
  active: boolean;
  scale?: number;
  onValue: (v: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  onValue(useDockRoom(ref, scale, active));
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => ({ width }) as DOMRect;
      }}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useDockRoom', () => {
  it('measures the probe in dock px and follows its resizes', () => {
    width = 460;
    let resize: (() => void) | null = null;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const values: (number | null)[] = [];
    const { rerender, unmount } = render(
      <Probe active scale={1.15} onValue={(v) => values.push(v)} />,
    );
    expect(values.at(-1)).toBe(400);
    width = 230;
    resize!();
    rerender(<Probe active scale={1.15} onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBe(200);
    // Not laid out: the last answer stands.
    width = 0;
    resize!();
    rerender(<Probe active scale={1.15} onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBe(200);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('measures once where there is no ResizeObserver, a zero scale counting as 1', () => {
    width = 300;
    vi.stubGlobal('ResizeObserver', undefined);
    const values: (number | null)[] = [];
    render(<Probe active scale={0} onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBe(300);
  });

  it('is null while inactive (a phone)', () => {
    width = 300;
    const values: (number | null)[] = [];
    render(<Probe active={false} onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBeNull();
  });
});
