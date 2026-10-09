import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MIRROR,
  layOutIllustratePages,
  newLogoPage,
  type Element,
  type MirrorSettings,
} from '@livediagram/document';
import { withMirrorTwins, withTwinsAdded } from './mirror-commit';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/logo-pages.md "Mirror": a drawn element gets its twin in the same commit.
describe('mirror while drawing', () => {
  const pages = layOutIllustratePages([newLogoPage('l')]);
  const mirrored = pages.map((p) => ({ ...p, mirror: DEFAULT_MIRROR }));
  const shape = (id: string, x: number): Element =>
    ({ id, type: 'shape', shape: 'circle', x, y: -50, width: 100, height: 100 }) as Element;

  it('twins only what a commit adds', () => {
    const prev = [shape('old', -300)];
    const next = withTwinsAdded(prev, [...prev, shape('new', -400)], mirrored);
    expect(next.map((e) => e.id).slice(0, 2)).toEqual(['old', 'new']);
    expect(next).toHaveLength(3);
    expect((next[2] as Element & { x: number }).x).toBe(300);
    expect(next[2]!.id).not.toBe('new');
  });

  it('passes an edit through untouched', () => {
    const prev = [shape('old', -300)];
    const edited = [{ ...prev[0]!, x: -310 } as Element];
    expect(withTwinsAdded(prev, edited, mirrored)).toBe(edited);
  });

  it('commits as it was given while mirror is off for the page, or off Illustrate', async () => {
    const { track } = await import('@/lib/telemetry');
    let els: Element[] = [];
    const commit = (map: (e: Element[]) => Element[]) => {
      els = map(els);
    };
    const on = { current: new Map() as ReadonlyMap<string, MirrorSettings> };
    const ps = { current: pages as typeof pages | null };
    const draw = withMirrorTwins(commit, on, ps);
    draw((e) => [...e, shape('a', -300)]);
    expect(els).toHaveLength(1);
    // On for another page only: still no twin.
    on.current = new Map([['elsewhere', DEFAULT_MIRROR]]);
    draw((e) => [...e, shape('x', -300)]);
    expect(els).toHaveLength(2);
    on.current = new Map([[pages[0]!.id, DEFAULT_MIRROR]]);
    draw((e) => [...e, shape('b', -300)]);
    expect(els).toHaveLength(4);
    expect(track).toHaveBeenCalledWith('Element', 'Created', 'MirrorTwin');
    ps.current = null;
    draw((e) => [...e, shape('c', -300)]);
    expect(els).toHaveLength(5);
  });

  it('adds three twins for Both, and five for six-way radial, apart with Merge off', () => {
    const both = pages.map((p) => ({ ...p, mirror: { ...DEFAULT_MIRROR, axis: 'both' as const } }));
    const drawn = { ...shape('n', -400), y: -400 } as Element;
    expect(withTwinsAdded([], [drawn], both)).toHaveLength(4);
    const radial = pages.map((p) => ({
      ...p,
      mirror: { axis: 'radial' as const, copies: 6, merge: false },
    }));
    expect(withTwinsAdded([], [drawn], radial)).toHaveLength(6);
  });
});
