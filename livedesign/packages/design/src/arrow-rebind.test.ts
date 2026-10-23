import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  rebindArrowAnchorsAfterMove,
  type Anchor,
  type ArrowElement,
  type Element,
  type Endpoint,
  type ShapeElement,
} from './index';

// docs/specs/008-canvas/arrow-anchors.md "Auto-rebind".

const box = (
  id: string,
  x: number,
  y: number,
  extra: Partial<ShapeElement> = {},
): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 100,
  ...extra,
});
const pin = (elementId: string, anchor: Anchor): Endpoint => ({
  kind: 'pinned',
  elementId,
  anchor,
});
const arrow = (
  id: string,
  from: Endpoint,
  to: Endpoint,
  extra: Partial<ArrowElement> = {},
): ArrowElement => ({ id, type: 'arrow', from, to, ...extra });

const run = (els: Element[], moving: string[]) => rebindArrowAnchorsAfterMove(els, new Set(moving));
const ends = (els: Element[], id: string) => {
  const a = els.find((e) => e.id === id) as ArrowElement;
  const name = (ep: Endpoint) => (ep.kind === 'pinned' ? ep.anchor : ep.kind);
  return [name(a.from), name(a.to)];
};

afterEach(() => vi.restoreAllMocks());

describe('the trigger', () => {
  it('leaves an arrow whose path is clear, even when another side would look better', () => {
    const els = [box('a', 0, 0), box('b', 300, 0), arrow('x', pin('a', 's'), pin('b', 's'))];
    expect(run(els, ['b'])).toBe(els);
  });

  it('moves both ends of a path running through its own shape to the facing sides', () => {
    // B dragged from the right of A to its left: A.e -> B.w now runs through both.
    const els = [box('a', 0, 0), box('b', -300, 0), arrow('x', pin('a', 'e'), pin('b', 'w'))];
    expect(ends(run(els, ['b']), 'x')).toEqual(['w', 'e']);
  });

  it('re-anchors the end whose shape the path runs through, keeping the facing end', () => {
    const els = [box('a', 0, 0), box('b', 300, 0), arrow('x', pin('a', 'e'), pin('b', 'e'))];
    expect(ends(run(els, ['b']), 'x')).toEqual(['e', 'w']);
  });

  it('follows the drawn curve, not the chord', () => {
    const curved = arrow('x', pin('a', 's'), pin('b', 's'), {
      arrowStyle: 'curved',
      curveOffset: { dx: 0, dy: -100 },
    });
    expect(ends(run([box('a', 0, 0), box('b', 300, 0), curved], ['b']), 'x')).toEqual(['e', 'w']);
  });

  it('follows the drawn elbow of an angled arrow', () => {
    const angled = arrow('x', pin('a', 'n'), pin('b', 'w'), { arrowStyle: 'angled' });
    expect(ends(run([box('a', 0, 0), box('b', 300, 300), angled], ['b']), 'x')).toEqual(['e', 'n']);
  });
});

describe('semantics preserved: same position class, new side', () => {
  it('takes the quarter on the new side closer to the other end', () => {
    const els = [box('a', 0, 0), box('b', 300, 200), arrow('x', pin('a', 'nne'), pin('b', 'wnw'))];
    expect(ends(run(els, ['b']), 'x')).toEqual(['ese', 'wnw']);
  });

  it('takes the other quarter when another arrow holds the closer one', () => {
    const els = [
      box('a', 0, 0),
      box('b', 300, 200),
      // Below and right, so the holder does not cross the moved arrow.
      box('c', 300, 400),
      arrow('x', pin('a', 'nne'), pin('b', 'wnw')),
      arrow('held', pin('a', 'ese'), pin('c', 'w')),
    ];
    expect(ends(run(els, ['b']), 'x')).toEqual(['ene', 'wnw']);
  });

  it('takes the closer quarter when both are held', () => {
    const els = [
      box('a', 0, 0),
      box('b', 300, 200),
      box('c', 300, -300),
      arrow('x', pin('a', 'nne'), pin('b', 'wnw')),
      arrow('h1', pin('a', 'ese'), pin('c', 'w')),
      arrow('h2', pin('a', 'ene'), pin('c', 'w')),
    ];
    expect(ends(run(els, ['b']), 'x')).toEqual(['ese', 'wnw']);
  });

  it('breaks a tie towards the previous anchor', () => {
    const els = [box('a', 0, 0), box('b', 300, 0), arrow('x', pin('a', 'sse'), pin('b', 'nnw'))];
    expect(ends(run(els, ['b']), 'x')).toEqual(['ese', 'wnw']);
  });

  it('moves a corner to the facing corner closer to the other end, and keeps one already facing', () => {
    const els = [box('a', 0, 0), box('b', -300, 100), arrow('x', pin('a', 'ne'), pin('b', 'ne'))];
    expect(ends(run(els, ['b']), 'x')).toEqual(['sw', 'ne']);
  });

  it('keeps no memory: moving back does not restore the old anchor', () => {
    const els = [box('a', 0, 0), box('b', 300, 200), arrow('x', pin('a', 'nne'), pin('b', 'wnw'))];
    const moved = run(els, ['b']);
    const back = moved.map((e) => (e.id === 'b' ? box('b', 300, 0) : e));
    expect(ends(run(back, ['b']), 'x')).toEqual(['ese', 'wnw']);
  });
});

describe('which arrows and ends', () => {
  it('re-anchors an end the user placed by hand, dropping the old flag', () => {
    const handPlaced = { kind: 'pinned', elementId: 'a', anchor: 'e', manual: true } as Endpoint;
    const els = [box('a', 0, 0), box('b', -300, 0), arrow('x', handPlaced, pin('b', 'w'))];
    const out = run(els, ['b']).find((e) => e.id === 'x') as ArrowElement;
    expect(out.from).toEqual({ kind: 'pinned', elementId: 'a', anchor: 'w' });
  });

  it('moves the pinned end of an arrow with a free end, never the free end', () => {
    const free: Endpoint = { kind: 'free', x: -300, y: 50 };
    const els = [box('a', 0, 0), arrow('x', pin('a', 'e'), free)];
    const out = run(els, ['a']).find((e) => e.id === 'x') as ArrowElement;
    expect(out.from).toEqual(pin('a', 'w'));
    expect(out.to).toBe(free);
  });

  it('treats an on-arrow other end as a point', () => {
    const line = arrow('line', { kind: 'free', x: -300, y: 0 }, { kind: 'free', x: -300, y: 100 });
    const els = [
      box('a', 0, 0),
      line,
      arrow('x', pin('a', 'e'), { kind: 'on-arrow', arrowId: 'line', t: 0.5 }),
    ];
    expect(ends(run(els, ['a']), 'x')).toEqual(['w', 'on-arrow']);
  });

  it('skips arrows moved rigidly, self-loops and arrows off the moving set', () => {
    const rigid = [box('a', 0, 0), box('b', 300, 0), arrow('x', pin('a', 'e'), pin('b', 'e'))];
    expect(run(rigid, ['a', 'b'])).toBe(rigid);
    const loop = [box('a', 0, 0), arrow('x', pin('a', 'e'), pin('a', 'w'))];
    expect(run(loop, ['a'])).toBe(loop);
    expect(run(rigid, ['elsewhere'])).toBe(rigid);
  });

  it('chooses the side in the rotated frame', () => {
    // Spun 90deg: the local east side faces world south, the local north world east.
    const els = [
      box('a', 0, 0, { rotation: 90 }),
      box('b', 300, 0),
      arrow('x', pin('a', 'e'), pin('b', 'w')),
    ];
    expect(ends(run(els, ['b']), 'x')).toEqual(['n', 'w']);
  });
});

describe('edges and invariants', () => {
  it('keeps both anchors when the centres coincide', () => {
    const els = [box('a', 0, 0), box('b', 0, 0), arrow('x', pin('a', 'e'), pin('b', 'w'))];
    expect(run(els, ['b'])).toBe(els);
  });

  it('leaves an end pinned to a missing element alone', () => {
    const els = [box('a', 0, 0), arrow('x', pin('a', 'e'), pin('ghost', 'w'))];
    const out = run(els, ['a']).find((e) => e.id === 'x') as ArrowElement;
    expect(out.to).toEqual(pin('ghost', 'w'));
  });

  it('is idempotent and deterministic', () => {
    const els = [box('a', 0, 0), box('b', 300, 200), arrow('x', pin('a', 'nne'), pin('b', 'wnw'))];
    const once = run(els, ['b']);
    expect(run(once, ['b'])).toBe(once);
    expect(run(els, ['b'])).toEqual(once);
  });

  it('logs a trigger with a recognisable fingerprint', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    run([box('a', 0, 0), box('b', -300, 0), arrow('x', pin('a', 'e'), pin('b', 'w'))], ['b']);
    expect(debug).toHaveBeenCalledWith(
      '[arrow-rebind] trigger arrow=x end=from element=a side=w e->w',
    );
    expect(debug).toHaveBeenCalledWith(
      '[arrow-rebind] trigger arrow=x end=to element=b side=e w->e',
    );
  });
});

describe('anchor sets', () => {
  it('moves a quarter its circle does not offer to the facing corner', () => {
    // A square morphed into a circle kept its quarter end.
    const els = [
      box('a', 0, 0, { shape: 'circle' }),
      box('b', -300, 100),
      arrow('x', pin('a', 'nne'), pin('b', 'e')),
    ];
    const [from] = ends(run(els, ['b']), 'x');
    expect(['nw', 'sw']).toContain(from);
  });
});

describe('sides without anchors', () => {
  it('moves a triangle end to a face, never to its bare top', () => {
    // B above the triangle: kept on the base, the line runs up through it.
    const els = [
      box('a', 0, 200, { shape: 'triangle' }),
      box('b', 0, -200),
      arrow('x', pin('a', 's'), pin('b', 's')),
    ];
    const [from] = ends(run(els, ['b']), 'x');
    expect(['w', 'e']).toContain(from);
  });
});

describe('fallback logging', () => {
  it('says when the facing side or the class fell back', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    run(
      [
        box('a', 0, 200, { shape: 'triangle' }),
        box('b', 0, -200),
        arrow('x', pin('a', 's'), pin('b', 's')),
      ],
      ['b'],
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[arrow-rebind\] trigger arrow=x end=from element=a side=[ew] s->[ew] fallback=side$/,
      ),
    );
    debug.mockClear();
    run(
      [
        box('a', 0, 0, { shape: 'circle' }),
        box('b', -300, 100),
        arrow('x', pin('a', 'nne'), pin('b', 'e')),
      ],
      ['b'],
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[arrow-rebind\] trigger arrow=x end=from element=a side=w nne->(nw|sw) fallback=class$/,
      ),
    );
  });
});
