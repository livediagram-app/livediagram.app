// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  layOutPages,
  pagesOf,
  pageScreenRect,
  type Element,
  type ScreenLink,
  type Page,
  type Tab,
} from '@livedesign/design';

const m = vi.hoisted(() => ({ phone: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => m.phone,
}));

import { PrototypePlayer, prefersReducedMotion } from './PrototypePlayer';
import { svgInner } from './PrototypeScreen';
import { PROTOTYPE_FLASH_MS } from '@/lib/prototype-player';

// docs/specs/007-editor/wireframe-pages.md "Prototype mode": the player in its device frame, its hotspots, the flash,
// the keys, the transitions and the phone.
const wire = (id: string, name?: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  device: 'iphone',
  ...(name ? { name } : {}),
});
const pageList = [wire('p1', 'Home'), wire('p2', 'Cart'), wire('p3', 'Done')];
const laid = layOutPages(pagesOf({ pages: pageList }));
const linked = (id: string, page: number, link: ScreenLink): Element => {
  const s = pageScreenRect(laid[page]!);
  return { ...createShape('square', s.x + 40, s.y + 120), id, link };
};
const tabWith = (elements: Element[]): Tab => ({
  id: 't1',
  name: 'Flow',
  elements,
  pages: pageList,
});
const tab = tabWith([
  linked('go-cart', 0, { kind: 'page', pageId: 'p2', transition: 'slide' }),
  linked('go-back', 1, { kind: 'back', transition: 'slide' }),
  linked('fade', 1, { kind: 'page', pageId: 'p3', transition: 'dissolve' }),
]);

function play(over: Partial<Parameters<typeof PrototypePlayer>[0]> = {}) {
  const onClose = vi.fn();
  const copyLink = vi.fn();
  const view = render(
    <PrototypePlayer tab={tab} startId="p1" onClose={onClose} copyLink={copyLink} {...over} />,
  );
  return { view, onClose, copyLink };
}

const shownScreenId = () =>
  document
    .querySelector('[data-prototype-stage] > div:last-child [data-prototype-screen]')
    ?.getAttribute('data-prototype-screen');
const hotspot = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  m.phone = false;
  document.documentElement.classList.remove('reduce-motion');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PrototypePlayer', () => {
  it('plays one screen in its device frame, saying which and where', () => {
    play();
    expect(screen.getByRole('dialog', { name: 'Prototype' })).toBeTruthy();
    expect(shownScreenId()).toBe('p1');
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    const svg = document.querySelector('[data-prototype-screen="p1"]')!;
    const r = laid[0]!.rect;
    expect(svg.getAttribute('viewBox')).toBe(`${r.x} ${r.y} ${r.width} ${r.height}`);
    // Drawn as an export draws it: the screen's clip under the player's own prefix.
    expect(svg.innerHTML).toContain('lvd-proto-p1-screen');
  });

  it('follows a hotspot to its screen, and a back link back', () => {
    play();
    fireEvent.click(hotspot('Goes to Cart'));
    expect(shownScreenId()).toBe('p2');
    expect(screen.getByText('2 of 3')).toBeTruthy();
    fireEvent.click(hotspot('Goes back to the screen before'));
    expect(shownScreenId()).toBe('p1');
  });

  it('flashes the hotspots on a press anywhere else, for a moment', () => {
    vi.useFakeTimers();
    play();
    const spot = hotspot('Goes to Cart');
    expect(spot.getAttribute('class')).toContain('fill-transparent');
    fireEvent.pointerDown(document.querySelector('[data-prototype-stage]')!);
    expect(spot.getAttribute('class')).toContain('fill-brand-500');
    // A second press restarts the moment.
    fireEvent.pointerDown(document.querySelector('[data-prototype-stage]')!);
    act(() => {
      vi.advanceTimersByTime(PROTOTYPE_FLASH_MS);
    });
    expect(spot.getAttribute('class')).toContain('fill-transparent');
    // A press on a hotspot is no flash.
    fireEvent.pointerDown(spot);
    expect(spot.getAttribute('class')).toContain('fill-transparent');
  });

  it('steps with Previous, Next and the arrow keys, stopping at the ends', () => {
    play();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Previous screen' }).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next screen' }));
    expect(shownScreenId()).toBe('p2');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shownScreenId()).toBe('p3');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Next screen' }).disabled).toBe(
      true,
    );
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('button', { name: 'Previous screen' }));
    expect(shownScreenId()).toBe('p1');
  });

  it('follows a focused hotspot on Enter or Space, and holds the editor’s shortcuts off', () => {
    const editorKeys = vi.fn();
    document.addEventListener('keydown', editorKeys);
    play();
    const spot = hotspot('Goes to Cart');
    spot.focus();
    fireEvent.keyDown(spot, { key: 'Enter' });
    expect(shownScreenId()).toBe('p2');
    fireEvent.keyDown(hotspot('Goes to Done'), { key: ' ' });
    expect(shownScreenId()).toBe('p3');
    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(shownScreenId()).toBe('p3');
    expect(editorKeys).not.toHaveBeenCalled();
    document.removeEventListener('keydown', editorKeys);
  });

  it('closes on Escape or Close with the screen last shown, handing focus back', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    const { onClose, view } = play();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.click(hotspot('Goes to Cart'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenLastCalledWith('p2');
    fireEvent.click(screen.getByRole('button', { name: 'Close prototype' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('copies the prototype link where there is one', () => {
    const { copyLink } = play();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Prototype Link' }));
    expect(copyLink).toHaveBeenCalled();
    cleanup();
    play({ copyLink: null });
    expect(screen.queryByRole('button', { name: 'Copy Prototype Link' })).toBeNull();
  });

  it('moves to the first screen when the one shown is deleted, and draws nothing with no screens', () => {
    const { view, onClose } = play({ startId: 'p3' });
    const without = { ...tab, pages: pageList.slice(0, 2) } as Tab;
    view.rerender(<PrototypePlayer tab={without} startId="p3" onClose={onClose} copyLink={null} />);
    expect(shownScreenId()).toBe('p1');
    view.rerender(
      <PrototypePlayer
        tab={{ ...tab, pages: [] }}
        startId={null}
        onClose={onClose}
        copyLink={null}
      />,
    );
  });
});

describe('PrototypePlayer transitions', () => {
  function withAnimate() {
    const animations: {
      frames: Keyframe[];
      finish: () => void;
      cancel: ReturnType<typeof vi.fn>;
    }[] = [];
    const animate = vi.fn(function (this: HTMLElement, frames: Keyframe[]) {
      const a = {
        frames,
        onfinish: null as null | (() => void),
        cancel: vi.fn(),
        finish: () => a.onfinish?.(),
      };
      animations.push(a);
      return a as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: animate,
      configurable: true,
      writable: true,
    });
    return animations;
  }
  afterEach(() => {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  it('slides the new screen in over the old one, the other way going back', () => {
    const animations = withAnimate();
    play();
    fireEvent.click(hotspot('Goes to Cart'));
    // Both screens on the stage while it moves.
    expect(document.querySelectorAll('[data-prototype-screen]').length).toBe(2);
    expect(animations[0]!.frames[0]).toEqual({ transform: 'translateX(100%)' });
    expect(animations[1]!.frames[1]).toEqual({ transform: 'translateX(-33%)', opacity: 0.6 });
    act(() => animations[0]!.finish());
    expect(document.querySelectorAll('[data-prototype-screen]').length).toBe(1);
    fireEvent.click(hotspot('Goes back to the screen before'));
    expect(animations[2]!.frames[0]).toEqual({ transform: 'translateX(-100%)' });
  });

  it('dissolves the new screen in', () => {
    const animations = withAnimate();
    play({ startId: 'p2' });
    fireEvent.click(hotspot('Goes to Done'));
    expect(animations[0]!.frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it('changes at once under reduced motion, and where nothing animates', () => {
    const animations = withAnimate();
    document.documentElement.classList.add('reduce-motion');
    expect(prefersReducedMotion()).toBe(true);
    play();
    fireEvent.click(hotspot('Goes to Cart'));
    expect(animations).toHaveLength(0);
    expect(document.querySelectorAll('[data-prototype-screen]').length).toBe(1);
    cleanup();
    document.documentElement.classList.remove('reduce-motion');
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
    play();
    fireEvent.click(hotspot('Goes to Cart'));
    expect(document.querySelectorAll('[data-prototype-screen]').length).toBe(1);
  });

  it('reads the system’s reduced motion', () => {
    expect(prefersReducedMotion()).toBe(false);
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: true }),
      configurable: true,
    });
    expect(prefersReducedMotion()).toBe(true);
    delete (window as { matchMedia?: unknown }).matchMedia;
  });
});

describe('PrototypePlayer on a phone', () => {
  it('fills the screen with the screen alone, its bar a floating pill', () => {
    m.phone = true;
    play();
    const svg = document.querySelector('[data-prototype-screen="p1"]')!;
    const s = pageScreenRect(laid[0]!);
    expect(svg.getAttribute('viewBox')).toBe(`${s.x} ${s.y} ${s.width} ${s.height}`);
    expect(document.querySelector('[data-prototype-bar="phone"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy Prototype Link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next screen' }));
    expect(shownScreenId()).toBe('p2');
    fireEvent.click(screen.getByRole('button', { name: 'Previous screen' }));
    expect(shownScreenId()).toBe('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Close prototype' }));
  });
});

describe('svgInner', () => {
  it('takes the root element off, and reads nothing from markup that is not an SVG', () => {
    expect(svgInner('<svg a="1" viewBox="0 0 1 1">\n<rect/>\n</svg>')).toBe('\n<rect/>\n');
    expect(svgInner('nothing')).toBe('');
  });
});
