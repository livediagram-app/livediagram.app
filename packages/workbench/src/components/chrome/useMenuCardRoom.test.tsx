// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { menuNaturalRight } from '../canvas/menu-join';
import { menuCardFormFor, useMenuCardFit, useMenuCardRoom } from './useMenuCardRoom';

// docs/specs/007-editor/toolbar-layout.md "The tab's name": the menu box never runs under the strip (Work Tracker 1038).

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function mountStrip(rect: DOMRect) {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(rect);
  root.append(card);
  document.body.append(root);
}

function Probe({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const room = useMenuCardRoom(ref, enabled);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => new DOMRect(12, 12, 400, 46);
      }}
      data-testid="card"
    >
      {room === null ? 'none' : room}
    </div>
  );
}

describe('useMenuCardRoom', () => {
  it('is the room left of a strip in the card’s row, less the strip’s gap', () => {
    // A crowded strip at the right of a 768px window: 768 - 12 - 425.
    mountStrip(new DOMRect(331, 12, 425, 46));
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe(String(331 - 8 - 12));
  });

  it('caps nothing with no strip, a strip below the card, or switched off', () => {
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe('none');
    cleanup();
    mountStrip(new DOMRect(331, 80, 425, 46));
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe('none');
    cleanup();
    document.body.innerHTML = '';
    mountStrip(new DOMRect(331, 12, 425, 46));
    render(<Probe enabled={false} />);
    expect(screen.getByTestId('card').textContent).toBe('none');
  });

  it('follows the strip as it moves, the card staying put', () => {
    mountStrip(new DOMRect(331, 12, 425, 46));
    render(<Probe />);
    const strip = document.querySelector<HTMLElement>('[data-tour-id="palette"]')!;
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue(new DOMRect(500, 12, 425, 46));
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('card').textContent).toBe(String(500 - 8 - 12));
  });

  it('is never negative', () => {
    mountStrip(new DOMRect(10, 12, 425, 46));
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe('0');
  });
});

// Work Tracker 1038, the second pass: short of room, the mode switch drops to its icon; the menu button and the switch
// are never capped or cut (nothing in the box gives way since the tab's name left it, Work Tracker 1289).
describe('menuCardFormFor', () => {
  const fixed = { full: 120, icon: 60 };
  it('stays whole while the whole box fits, or nothing limits it', () => {
    expect(menuCardFormFor(null, fixed)).toBe('full');
    expect(menuCardFormFor(120, fixed)).toBe('full');
    // Not measured yet: tried whole first.
    expect(menuCardFormFor(10, { full: null, icon: null })).toBe('full');
  });

  it('drops the switch to its icon, then goes bare', () => {
    expect(menuCardFormFor(119, fixed)).toBe('icon');
    expect(menuCardFormFor(60, fixed)).toBe('icon');
    expect(menuCardFormFor(59, fixed)).toBe('bare');
    expect(menuCardFormFor(0, fixed)).toBe('bare');
    // The icon form not measured yet: tried before going bare.
    expect(menuCardFormFor(0, { full: 120, icon: null })).toBe('icon');
  });
});

describe('useMenuCardFit', () => {
  // A box 120px wide whole, 60 with the switch's icon alone.
  function FitProbe({ enabled = true }: { enabled?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const { form } = useMenuCardFit(ref, enabled);
    return (
      <div
        ref={(el) => {
          ref.current = el;
          if (!el) return;
          el.getBoundingClientRect = () =>
            new DOMRect(12, 12, el.dataset.menuForm === 'full' ? 120 : 60, 46);
        }}
        data-menu-form={form}
        data-testid="card"
      >
        <span data-testid="state">{form}</span>
      </div>
    );
  }
  const state = () => screen.getByTestId('state').textContent;

  it('is whole where the whole box fits, keeping its width for the strip to go by', () => {
    mountStrip(new DOMRect(320, 12, 425, 46));
    render(<FitProbe />);
    expect(state()).toBe('full');
    const card = screen.getByTestId('card');
    expect(card.dataset.menuNaturalWidth).toBe('120');
    // Never capped: nothing in the box gives way.
    expect(card.style.maxWidth).toBe('');
  });

  it('drops the switch to its icon, keeping the whole width for the strip to go by', () => {
    mountStrip(new DOMRect(130, 12, 425, 46));
    render(<FitProbe />);
    expect(state()).toBe('icon');
    // Drawn 60 wide, but the strip still sees the whole box, so it never comes back over it.
    expect(menuNaturalRight(screen.getByTestId('card'))).toBe(12 + 120);
  });

  it('goes bare where even the icon form does not fit', () => {
    mountStrip(new DOMRect(70, 12, 425, 46));
    render(<FitProbe />);
    expect(state()).toBe('bare');
  });

  it('is whole with no strip in its row or switched off', () => {
    render(<FitProbe />);
    expect(state()).toBe('full');
    cleanup();
    mountStrip(new DOMRect(70, 12, 425, 46));
    render(<FitProbe enabled={false} />);
    expect(state()).toBe('full');
  });

  it('measures again as its parts resize', () => {
    let resized = () => {};
    const observed: Element[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resized = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      },
    );
    try {
      mountStrip(new DOMRect(320, 12, 425, 46));
      render(<FitProbe />);
      expect(observed.length).toBeGreaterThan(0);
      act(() => resized());
      expect(state()).toBe('full');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
