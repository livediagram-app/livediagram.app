// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { menuNaturalRight } from '../canvas/menu-join';
import {
  menuCardFormFor,
  NAME_SLOT_MIN_PX,
  useMenuCardFit,
  useMenuCardRoom,
} from './useMenuCardRoom';

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

// Work Tracker 1038, the second pass: short of room, the mode switch drops to its icon, then the name hides; the menu
// button and the switch are never cut.
describe('menuCardFormFor', () => {
  const fixed = { full: 120, icon: 60 };
  it('stays whole while the button, the named switch and a readable name slot fit, or nothing caps it', () => {
    expect(menuCardFormFor(null, fixed)).toBe('full');
    expect(menuCardFormFor(120 + NAME_SLOT_MIN_PX, fixed)).toBe('full');
    // Not measured yet: tried whole first.
    expect(menuCardFormFor(10, { full: null, icon: null })).toBe('full');
  });

  it('stays whole where the whole box fits, a name shorter than the slot included', () => {
    // A short name: the box is 150 whole, short of the 120 + 64 a slot would ask, and the strip stays centred.
    expect(menuCardFormFor(150, { ...fixed, whole: 150 })).toBe('full');
    expect(menuCardFormFor(149, { ...fixed, whole: 150 })).toBe('icon');
    expect(menuCardFormFor(149, { ...fixed, whole: null })).toBe('icon');
  });

  it('drops the switch to its icon, then hides the name', () => {
    expect(menuCardFormFor(120 + NAME_SLOT_MIN_PX - 1, fixed)).toBe('icon');
    expect(menuCardFormFor(60 + NAME_SLOT_MIN_PX, fixed)).toBe('icon');
    expect(menuCardFormFor(60 + NAME_SLOT_MIN_PX - 1, fixed)).toBe('bare');
    expect(menuCardFormFor(0, fixed)).toBe('bare');
    // The icon form not measured yet: tried before hiding the name.
    expect(menuCardFormFor(0, { full: 120, icon: null })).toBe('icon');
  });
});

describe('useMenuCardFit', () => {
  // A box needing 120px beside the name whole, 60 with the switch's icon alone; its name 40px wide while shown.
  function FitProbe({ enabled = true }: { enabled?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const { maxWidth, form } = useMenuCardFit(ref, enabled);
    return (
      <div
        ref={(el) => {
          ref.current = el;
          if (!el) return;
          el.getBoundingClientRect = () => {
            const shown = el.dataset.menuForm;
            const need = shown === 'full' ? 120 : 60;
            return new DOMRect(12, 12, need + (shown === 'bare' ? 0 : 40), 46);
          };
        }}
        data-menu-form={form}
        data-testid="card"
      >
        <span data-testid="state">{`${form} ${maxWidth ?? 'none'}`}</span>
        <span
          data-tab-name-in-box=""
          ref={(el) => {
            if (!el) return;
            Object.defineProperty(el, 'offsetWidth', {
              configurable: true,
              get: () => (form === 'bare' ? 0 : 40),
            });
            // It starts where the button and the switch end, whatever the cap.
            el.getBoundingClientRect = () =>
              new DOMRect(12 + (form === 'full' ? 120 : 60), 12, 40, 20);
          }}
        />
      </div>
    );
  }
  const state = () => screen.getByTestId('state').textContent;

  it('is whole and capped at the room where a readable name fits', () => {
    mountStrip(new DOMRect(320, 12, 425, 46));
    render(<FitProbe />);
    expect(state()).toBe('full 300');
    expect(screen.getByTestId('card').dataset.menuNaturalWidth).toBe('160');
  });

  it('drops the switch to its icon, keeping the whole width for the strip to go by', () => {
    mountStrip(new DOMRect(170, 12, 425, 46));
    render(<FitProbe />);
    expect(state()).toBe('icon 150');
    const card = screen.getByTestId('card');
    // Drawn 100 wide, but the strip still sees the whole box, so it never comes back over it.
    expect(menuNaturalRight(card)).toBe(12 + 160);
  });

  it('hides the name below a readable slot and caps nothing, so the button and the switch are never cut', () => {
    mountStrip(new DOMRect(120, 12, 425, 46));
    render(<FitProbe />);
    expect(state()).toBe('bare none');
  });

  it('is whole and uncapped with no strip in its row or switched off', () => {
    render(<FitProbe />);
    expect(state()).toBe('full none');
    cleanup();
    mountStrip(new DOMRect(120, 12, 425, 46));
    render(<FitProbe enabled={false} />);
    expect(state()).toBe('full none');
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
      expect(state()).toBe('full 300');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('counts the box’s own end at its UI scale, and the whole box with no name', () => {
    function Bare({ name }: { name: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const { form } = useMenuCardFit(ref, true);
      return (
        <div
          ref={(el) => {
            ref.current = el;
            if (!el) return;
            el.style.paddingRight = '4px';
            el.style.borderRightWidth = '1px';
            Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 100 });
            el.getBoundingClientRect = () => new DOMRect(12, 12, 200, 46);
          }}
          data-menu-form={form}
          data-testid="card"
        >
          <span data-testid="state">{form}</span>
          {name ? (
            <span
              data-tab-name-in-box=""
              ref={(el) => {
                if (!el) return;
                Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 40 });
                el.getBoundingClientRect = () => new DOMRect(12 + 100, 12, 40, 20);
              }}
            />
          ) : null}
        </div>
      );
    }
    // Room 160: 100 to the name, plus 5 of padding and border drawn at 2x, is 110; with a 64px slot, 174, too much.
    mountStrip(new DOMRect(180, 12, 425, 46));
    render(<Bare name />);
    expect(state()).toBe('bare');
    cleanup();
    document.body.innerHTML = '';
    // No name: the whole box, 200, never fits a slot beside it either.
    mountStrip(new DOMRect(180, 12, 425, 46));
    render(<Bare name={false} />);
    expect(state()).toBe('bare');
  });
});
