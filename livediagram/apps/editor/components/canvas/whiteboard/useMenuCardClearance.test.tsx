// @vitest-environment jsdom

// A top-docked Draw dock keeps 8px clear of the menu card, measured, since the card now holds the editor mode switch
// too (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits").
import { useRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { menuCardClearance, useMenuCardClearance } from './useMenuCardClearance';

const rect = (left: number, width: number) =>
  ({ left, right: left + width, top: 0, bottom: 40, width, height: 40 }) as DOMRect;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('menuCardClearance', () => {
  it('is the card right edge from the container, plus the gap', () => {
    expect(menuCardClearance(rect(12, 98), rect(0, 390), 1)).toBe(118);
  });

  it('is in the dock units at a UI scale', () => {
    expect(menuCardClearance(rect(12, 98), rect(0, 390), 2)).toBe(59);
  });

  it('treats a scale of zero as 1', () => {
    expect(menuCardClearance(rect(0, 10), rect(0, 100), 0)).toBe(18);
  });
});

function Probe({ active, onValue }: { active: boolean; onValue: (v: number | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  onValue(useMenuCardClearance(ref, 1, active));
  return <div ref={ref} />;
}

function mountCard(width: number) {
  const card = document.createElement('div');
  card.setAttribute('data-toolbar-menu', '');
  card.getBoundingClientRect = () => rect(12, width);
  document.body.append(card);
  return card;
}

describe('useMenuCardClearance', () => {
  it('measures the card and follows its resizes', () => {
    const card = mountCard(98);
    let resize: (() => void) | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const values: (number | null)[] = [];
    const { rerender, unmount } = render(<Probe active onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBe(118);
    expect(observe).toHaveBeenCalledWith(card);
    card.getBoundingClientRect = () => rect(12, 200);
    resize!();
    rerender(<Probe active onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBe(220);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('measures once where there is no ResizeObserver', () => {
    mountCard(50);
    vi.stubGlobal('ResizeObserver', undefined);
    const values: (number | null)[] = [];
    render(<Probe active onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBe(70);
  });

  it('is null with no card, and when inactive (a bottom dock)', () => {
    const values: (number | null)[] = [];
    render(<Probe active onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBeNull();
    cleanup();
    mountCard(98);
    render(<Probe active={false} onValue={(v) => values.push(v)} />);
    expect(values.at(-1)).toBeNull();
  });
});
