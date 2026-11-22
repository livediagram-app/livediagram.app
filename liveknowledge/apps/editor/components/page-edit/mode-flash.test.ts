// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flashMode, ringAt, visibleDocumentBox } from './mode-flash';

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

describe('visibleDocumentBox', () => {
  it('clears the docked page tree on the left and the rail on the right', () => {
    const area = box(0, 48, 1128, 852);
    expect(visibleDocumentBox(area, [box(0, 0, 264, 852), box(1128, 48, 1440, 852)])).toEqual(
      box(264, 48, 1128, 852),
    );
    expect(visibleDocumentBox(box(0, 48, 1440, 852), [box(1128, 48, 1440, 852)])).toEqual(
      box(0, 48, 1128, 852),
    );
  });

  it('ignores chrome that is hidden, empty or off the area rows', () => {
    const area = box(0, 48, 1000, 800);
    expect(visibleDocumentBox(area, [box(0, 0, 0, 0), box(0, 900, 264, 950)])).toEqual(area);
  });
});

describe('flashMode', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const scroller = () => {
    const el = document.createElement('div');
    el.setAttribute('data-page-scroller', '');
    el.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 48, width: 1000, height: 700 });
    const side = document.createElement('aside');
    side.setAttribute('data-contents-sidebar', '');
    side.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 260, height: 748 });
    document.body.append(el, side);
  };

  it('draws one ripple over the visible document area, in the mode colour, then clears it', () => {
    vi.useFakeTimers();
    scroller();
    flashMode('edit');
    flashMode('save');
    const ripples = document.querySelectorAll<HTMLElement>('[data-mode-ripple]');
    expect(ripples).toHaveLength(1);
    const r = ripples[0]!;
    expect(r.dataset.modeRipple).toBe('save');
    expect([r.style.left, r.style.top, r.style.width, r.style.height]).toEqual([
      '260px',
      '48px',
      '740px',
      '700px',
    ]);
    expect(r.querySelectorAll('.lk-mode-ripple-ring')).toHaveLength(3);
    r.lastElementChild!.dispatchEvent(new Event('animationend'));
    expect(document.querySelector('[data-mode-ripple]')).toBeNull();
    flashMode('cancel');
    vi.runAllTimers();
    expect(document.querySelector('[data-mode-ripple]')).toBeNull();
  });

  it('draws nothing without a document area, or with none of it in view', () => {
    flashMode('edit');
    expect(document.querySelector('[data-mode-ripple]')).toBeNull();
    const el = document.createElement('div');
    el.setAttribute('data-page-scroller', '');
    document.body.append(el);
    flashMode('edit');
    expect(document.querySelector('[data-mode-ripple]')).toBeNull();
  });

  it('rings out from the pointer and clears the ring', () => {
    vi.useFakeTimers();
    ringAt(10, 20);
    const ring = document.querySelector<HTMLElement>('.lk-click-ring')!;
    expect([ring.style.left, ring.style.top]).toEqual(['10px', '20px']);
    ring.dispatchEvent(new Event('animationend'));
    expect(document.querySelector('.lk-click-ring')).toBeNull();
    ringAt(1, 1);
    vi.runAllTimers();
    expect(document.querySelector('.lk-click-ring')).toBeNull();
  });
});
