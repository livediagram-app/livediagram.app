// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';
import { ARROW_SIZE, EDGE_GAP, OBSTACLE_GAP, type Point } from './people-arrows-geometry';
import { createPeopleArrowsEngine, measureObstacles } from './people-arrows-engine';

// docs/specs/008-canvas/people-arrows.md "Following along", "Where it sits", "Performance"
const W = 1200;
const H = 800;
const RAIL = EDGE_GAP + ARROW_SIZE / 2;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  } as DOMRect;
}

function setup(opts: { reduced?: boolean } = {}) {
  const host = document.createElement('main');
  const layer = document.createElement('div');
  host.appendChild(layer);
  document.body.appendChild(host);
  host.getBoundingClientRect = () => rect(0, 50, W, H);
  Object.defineProperty(layer, 'clientWidth', { value: W });
  Object.defineProperty(layer, 'clientHeight', { value: H });
  let view: View = { zoom: 1, offset: { x: 0, y: 0 } };
  const feet = new Map<string, Point>();
  const frames: ((now: number) => void)[] = [];
  const intervals = new Map<number, () => void>();
  let nextId = 1;
  const engine = createPeopleArrowsEngine(
    layer,
    {
      view: () => view,
      feetOf: (id) => feet.get(id) ?? null,
      reduced: () => opts.reduced ?? false,
    },
    {
      raf: (cb) => {
        frames.push(cb);
        return nextId++;
      },
      cancel: () => frames.splice(0),
      setInterval: (cb) => {
        intervals.set(nextId, cb);
        return nextId++;
      },
      clearInterval: (id) => intervals.delete(id),
    },
  );
  let now = 1000;
  // Runs the loop until it stops (or a cap), as the browser would.
  const run = (max = 400) => {
    let n = 0;
    while (frames.length > 0 && n < max) {
      const cb = frames.shift()!;
      now += 16;
      cb(now);
      n++;
    }
    return n;
  };
  const arrow = (id: string) => {
    const root = document.createElement('button');
    const tip = document.createElement('span');
    root.appendChild(tip);
    layer.appendChild(root);
    engine.attach(id, { root, tip });
    return { root, tip };
  };
  return {
    host,
    layer,
    engine,
    feet,
    run,
    arrow,
    intervals,
    frames,
    setView: (v: View) => {
      view = v;
      engine.wake();
    },
  };
}

// A person whose body lands at screen (x, y) at zoom 1 and no offset.
const at = (x: number, y: number): Point => ({ x, y: y + AVATAR_HEIGHT / 2 });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the frame loop', () => {
  it('shows an arrow at the edge for someone off screen, pointing at them, and then stops', () => {
    const t = setup();
    t.feet.set('ada', at(1400, 400));
    const { root, tip } = t.arrow('ada');
    const frames = t.run();
    expect(frames).toBeLessThan(400);
    expect(t.frames).toHaveLength(0);
    expect(t.engine.motionOf('ada')).toMatchObject({ x: W - RAIL, y: 400 });
    // Just past the edge: nearly full strength.
    expect(t.engine.motionOf('ada')!.opacity).toBeGreaterThan(0.95);
    expect(root.dataset.shown).toBe('true');
    expect(root.getAttribute('aria-hidden')).toBeNull();
    expect(root.tabIndex).toBe(0);
    expect(root.style.pointerEvents).toBe('auto');
    // The style serialises each number short (1152.00px reads back 1152px), as a browser does.
    const x = Number(/^translate3d\((-?[\d.]+)px/.exec(root.style.transform)![1]);
    expect(x).toBeCloseTo(W - RAIL - ARROW_SIZE / 2, 2);
    expect(Number(/^rotate\((-?[\d.]+)rad\)$/.exec(tip.style.transform)![1])).toBeCloseTo(0, 4);
  });

  it('hides the arrow, out of reach, for someone in view', () => {
    const t = setup();
    t.feet.set('ada', at(600, 400));
    const { root } = t.arrow('ada');
    t.run();
    expect(root.dataset.shown).toBe('false');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.tabIndex).toBe(-1);
    expect(Number(root.style.opacity)).toBe(0);
  });

  it('moves along the edge as you walk (the view follows you), still pointing at them', () => {
    const t = setup();
    t.feet.set('ada', at(1400, 400));
    t.arrow('ada');
    t.run();
    // You walk 300 px down: the camera follows, so Ada is now up and to the right.
    t.setView({ zoom: 1, offset: { x: 0, y: -300 } });
    t.run();
    const m = t.engine.motionOf('ada')!;
    expect(m.x).toBe(W - RAIL);
    expect(m.y).toBeLessThan(400);
    expect(m.angle).toBeLessThan(0);
  });

  it('fades the arrow out as they come into view and back in when they leave it', () => {
    const t = setup();
    t.feet.set('ada', at(1400, 400));
    const { root } = t.arrow('ada');
    t.run();
    // You pan to them.
    t.setView({ zoom: 1, offset: { x: -800, y: 0 } });
    t.run();
    expect(root.dataset.shown).toBe('false');
    expect(t.engine.motionOf('ada')!.opacity).toBe(0);
    // And away again.
    t.setView({ zoom: 1, offset: { x: 0, y: 0 } });
    t.run();
    expect(root.dataset.shown).toBe('true');
    expect(t.engine.motionOf('ada')!.opacity).toBeGreaterThan(0.95);
  });

  it('follows a peer who walks off, woken by their steps', () => {
    const t = setup();
    t.feet.set('ada', at(600, 400));
    const { root } = t.arrow('ada');
    t.run();
    t.feet.set('ada', at(600, 2000));
    t.engine.wake();
    t.run();
    expect(root.dataset.shown).toBe('true');
    expect(t.engine.motionOf('ada')).toMatchObject({ x: 600, y: H - RAIL });
  });

  it('slides clear of a control measured from the page', () => {
    const t = setup();
    const dock = document.createElement('div');
    dock.setAttribute('data-canvas-obstacle', '');
    dock.getBoundingClientRect = () => rect(450, 50 + 740, 300, 50);
    t.host.appendChild(dock);
    t.feet.set('ada', at(600, 3000));
    t.arrow('ada');
    t.run();
    const m = t.engine.motionOf('ada')!;
    expect(m.y).toBe(H - RAIL);
    expect([450 - ARROW_SIZE / 2 - OBSTACLE_GAP, 750 + ARROW_SIZE / 2 + OBSTACLE_GAP]).toContain(
      m.x,
    );
    expect(Math.sin(m.angle)).toBeGreaterThan(0.9);
  });

  it('watches the controls while idle with an arrow showing, and moves when one opens over it', () => {
    const t = setup();
    t.feet.set('ada', at(1400, 400));
    t.arrow('ada');
    t.run();
    expect(t.intervals.size).toBe(1);
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    panel.getBoundingClientRect = () => rect(W - 300, 50 + 300, 300, 200);
    t.host.appendChild(panel);
    [...t.intervals.values()][0]!();
    t.run();
    expect(t.engine.motionOf('ada')!.y).not.toBe(400);
  });

  it('stops watching once no arrow shows, and on dispose', () => {
    const t = setup();
    t.feet.set('ada', at(1400, 400));
    t.arrow('ada');
    t.run();
    t.feet.delete('ada');
    t.engine.wake();
    t.run();
    expect(t.intervals.size).toBe(0);
    t.engine.attach('ada', null);
    t.engine.wake();
    t.engine.dispose();
    expect(t.frames).toHaveLength(0);
  });

  it('places and removes arrows at once under reduced motion', () => {
    const t = setup({ reduced: true });
    t.feet.set('ada', at(1400, 400));
    t.arrow('ada');
    expect(t.run()).toBe(1);
    expect(t.engine.motionOf('ada')).toMatchObject({ x: W - RAIL });
    expect(t.engine.motionOf('ada')!.opacity).toBeGreaterThan(0.95);
    t.setView({ zoom: 1, offset: { x: -800, y: 0 } });
    expect(t.run()).toBe(1);
    expect(t.engine.motionOf('ada')!.opacity).toBe(0);
  });

  it('measures again after a resize', () => {
    const t = setup();
    t.feet.set('ada', at(1400, 400));
    t.arrow('ada');
    t.run();
    t.engine.remeasure();
    expect(t.frames).toHaveLength(1);
    t.run();
  });
});

describe('measuring the controls', () => {
  it('measures the parts of a region, not its full-width wrapper, and skips hidden, empty and off-canvas ones', () => {
    const host = document.createElement('main');
    host.setAttribute('data-region', 'canvas');
    host.getBoundingClientRect = () => rect(0, 50, W, H);
    const layer = document.createElement('div');
    host.appendChild(layer);
    const region = document.createElement('div');
    region.setAttribute('data-region', 'palette');
    region.getBoundingClientRect = () => rect(0, 62, W, 53);
    const strip = document.createElement('div');
    strip.setAttribute('data-floating-panel', '');
    strip.getBoundingClientRect = () => rect(346, 62, 848, 53);
    region.appendChild(strip);
    const hidden = document.createElement('div');
    hidden.setAttribute('data-canvas-obstacle', '');
    hidden.setAttribute('aria-hidden', 'true');
    hidden.getBoundingClientRect = () => rect(0, 400, 100, 100);
    const empty = document.createElement('div');
    empty.setAttribute('data-canvas-obstacle', '');
    empty.getBoundingClientRect = () => rect(0, 400, 0, 0);
    const header = document.createElement('header');
    header.setAttribute('data-region', 'header');
    header.getBoundingClientRect = () => rect(0, 0, W, 50);
    // A popover portalled to the body, over the canvas.
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.getBoundingClientRect = () => rect(100, 150, 200, 100);
    host.append(region, hidden, empty);
    document.body.append(header, host, menu);
    expect(measureObstacles(host, layer)).toEqual([
      { left: 346, top: 12, right: 1194, bottom: 65 },
      { left: 100, top: 100, right: 300, bottom: 200 },
    ]);
  });
});
