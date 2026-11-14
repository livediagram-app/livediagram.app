// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureStrip, playStripMorph, visibleStripCard } from './strip-morph-dom';

// docs/specs/007-editor/toolbar-layout.md "Switching morphs the strip": the outgoing strip is read once, the
// incoming one once, and the morph plays on a bar behind the card, its contents crossfading, the toggle riding the
// bar's edge, and everything put back when it ends.

vi.mock('./ToolbarPalette', () => ({ CARD_CLASS: 'card-surface' }));

type Rect = { left: number; top: number; width: number; height: number };
const rects = new Map<Element, Rect>();
let observers: { cb: ResizeObserverCallback; disconnected: boolean }[] = [];
let animations: {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: () => void;
}[] = [];

function rectOf(el: Element): DOMRect {
  const r = rects.get(el) ?? { left: 0, top: 0, width: 0, height: 0 };
  return {
    ...r,
    x: r.left,
    y: r.top,
    right: r.left + r.width,
    bottom: r.top + r.height,
    toJSON: () => r,
  };
}

beforeEach(() => {
  rects.clear();
  observers = [];
  animations = [];
  document.documentElement.classList.remove('reduce-motion');
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectOf(this);
  });
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (rects.has(this) ? [rectOf(this)] : []) as unknown as DOMRectList;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      entry: { cb: ResizeObserverCallback; disconnected: boolean };
      constructor(cb: ResizeObserverCallback) {
        this.entry = { cb, disconnected: false };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true;
      }
    },
  );
  (Element.prototype as unknown as { animate: unknown }).animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const anim = {
      el: this,
      keyframes,
      options,
      cancel: vi.fn(),
      finished: new Promise(() => {}),
    };
    animations.push(anim);
    return anim;
  };
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// One strip: its root, its card, the toggle (with its pill), the divider after it, and two more items.
function strip({ shown, box }: { shown: boolean; box: Rect }) {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  card.setAttribute('data-floating-panel', '');
  const toggle = document.createElement('div');
  toggle.setAttribute('data-edit-walk-toggle', '');
  const pill = document.createElement('span');
  pill.setAttribute('aria-hidden', '');
  toggle.append(pill);
  const divider = document.createElement('span');
  const a = document.createElement('button');
  a.id = 'first';
  const b = document.createElement('button');
  card.append(toggle, divider, a, b);
  root.append(card);
  document.body.append(root);
  if (shown) {
    rects.set(root, { left: 0, top: 12, width: 1000, height: 60 });
    rects.set(card, box);
  }
  return { root, card, toggle, pill, divider, a, b };
}

const fire = () => {
  for (const o of observers) if (!o.disconnected) o.cb([], {} as ResizeObserver);
};

describe('visibleStripCard', () => {
  it('finds the card of the strip on screen, not a hidden one', () => {
    strip({ shown: false, box: { left: 0, top: 0, width: 0, height: 0 } });
    const { card } = strip({ shown: true, box: { left: 300, top: 12, width: 400, height: 44 } });
    expect(visibleStripCard(document)).toBe(card);
    expect(visibleStripCard(null)).toBeNull();
  });
});

describe('captureStrip', () => {
  it('reads the outgoing box and copies it without its anchors or its toggle', () => {
    strip({ shown: true, box: { left: 300, top: 12, width: 400, height: 44 } });
    const snap = captureStrip(document)!;
    expect(snap.box).toEqual({ left: 300, top: 12, width: 400, height: 44 });
    expect(snap.ghost.hasAttribute('data-tour-id')).toBe(false);
    expect(snap.ghost.hasAttribute('data-floating-panel')).toBe(false);
    expect(snap.ghost.querySelector('#first')).toBeNull();
    expect(snap.ghost.querySelector('[data-edit-walk-toggle]')).toBeNull();
    const [toggle, divider, item] = [...snap.ghost.children] as HTMLElement[];
    expect(toggle!.style.visibility).toBe('hidden');
    expect(divider!.style.visibility).toBe('hidden');
    expect(item!.style.visibility).toBe('');
  });

  it('captures nothing under reduced motion, so the switch is instant', () => {
    strip({ shown: true, box: { left: 300, top: 12, width: 400, height: 44 } });
    document.documentElement.classList.add('reduce-motion');
    expect(captureStrip(document)).toBeNull();
  });

  it('captures nothing when no strip shows (Zen, a load)', () => {
    strip({ shown: false, box: { left: 0, top: 0, width: 0, height: 0 } });
    expect(captureStrip(document)).toBeNull();
  });

  it('starts a second morph from the bar as drawn', () => {
    const { root } = strip({ shown: true, box: { left: 300, top: 12, width: 400, height: 44 } });
    const surface = document.createElement('div');
    surface.setAttribute('data-strip-morph-surface', '');
    root.prepend(surface);
    rects.set(surface, { left: 280, top: 12, width: 440, height: 44 });
    expect(captureStrip(document)!.box.width).toBe(440);
  });
});

describe('playStripMorph', () => {
  function play(to: 'walk' | 'edit') {
    const old = strip({ shown: true, box: { left: 300, top: 12, width: 400, height: 44 } });
    const snap = captureStrip(document)!;
    old.root.remove();
    const next = strip({ shown: true, box: { left: 250, top: 12, width: 500, height: 44 } });
    const stop = playStripMorph(document, snap, to);
    return { next, stop, snap };
  }

  it('waits for the incoming strip to settle (its first resize report) before measuring', () => {
    const { next } = play('walk');
    expect(animations).toHaveLength(0);
    expect(next.card.style.animation).toBe('none');
    fire();
    expect(animations.length).toBeGreaterThan(0);
  });

  it('resizes a bar behind the card from the old box to the new, the card clipped to it', () => {
    const { next } = play('walk');
    fire();
    const surface = next.root.querySelector<HTMLElement>('[data-strip-morph-surface]')!;
    expect(surface.className).toBe('card-surface');
    expect(next.root.firstElementChild).toBe(surface);
    const bar = animations.find((a) => a.el === surface)!;
    expect(bar.keyframes[0]).toMatchObject({ left: '300px', width: '400px' });
    expect(bar.keyframes[1]).toMatchObject({ left: '250px', width: '500px' });
    const clip = animations.find((a) => a.el === next.card)!;
    expect(clip.keyframes[0]!.clipPath).toBe('inset(0px 50px 0px 50px round 0px)');
    expect(next.card.style.backgroundColor).toBe('transparent');
    expect(next.card.style.backgroundImage).toBe('none');
  });

  it('rides the toggle and its divider along the bar edge and glides the pill to Walk', () => {
    const { next } = play('walk');
    fire();
    for (const el of [next.toggle, next.divider])
      expect(animations.find((a) => a.el === el)!.keyframes[0]!.transform).toBe('translateX(50px)');
    const pill = animations.find((a) => a.el === next.pill)!;
    expect(pill.keyframes.map((k) => k.transform)).toEqual(['translateX(0%)', 'translateX(100%)']);
  });

  it('fades the old contents out to the left and slides the new ones in from the right on Walk', () => {
    const { next, snap } = play('walk');
    fire();
    expect(next.card.contains(snap.ghost)).toBe(true);
    expect(snap.ghost.inert).toBe(true);
    const out = animations.find((a) => a.el === snap.ghost)!;
    expect(out.keyframes[1]).toMatchObject({ opacity: 0, transform: 'translateX(-12px)' });
    const first = animations.find((a) => a.el === next.a)!;
    const second = animations.find((a) => a.el === next.b)!;
    expect(first.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateX(12px)' });
    expect(second.options.delay).toBeGreaterThan(first.options.delay!);
  });

  it('brings Edit in from the left, the pill gliding back', () => {
    const { next } = play('edit');
    fire();
    expect(animations.find((a) => a.el === next.a)!.keyframes[0]!.transform).toBe(
      'translateX(-12px)',
    );
    expect(animations.find((a) => a.el === next.pill)!.keyframes[0]!.transform).toBe(
      'translateX(100%)',
    );
  });

  it('puts everything back when stopped, the card fade-in staying off', () => {
    const { next, stop, snap } = play('walk');
    fire();
    stop();
    expect(next.root.querySelector('[data-strip-morph-surface]')).toBeNull();
    expect(next.card.contains(snap.ghost)).toBe(false);
    expect(next.card.style.background).toBe('');
    expect(next.card.style.position).toBe('');
    expect(next.card.style.animation).toBe('none');
    for (const a of animations) expect(a.cancel).toHaveBeenCalled();
  });

  it('plays nothing when stopped before the strip settled', () => {
    const { stop } = play('walk');
    stop();
    fire();
    expect(animations).toHaveLength(0);
  });
});
