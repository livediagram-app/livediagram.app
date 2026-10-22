// @vitest-environment jsdom
// docs/specs/007-editor/pages-mode.md, "A page's label zooms to it": a framed page keeps clear of the bottom-right
// controls.
import { afterEach, describe, expect, it } from 'vitest';
import { BOTTOM_CLUSTER_GAP, bottomClusterInset } from './top-strip-inset';

const box = (
  el: HTMLElement,
  r: { top: number; bottom: number; left?: number; right?: number },
) => {
  el.getBoundingClientRect = () =>
    ({ left: 0, right: 1000, ...r, height: r.bottom - r.top, width: 1000 }) as DOMRect;
};

afterEach(() => document.body.replaceChildren());

describe('the bottom controls inset', () => {
  it('is how far the controls reach up, plus a gap, as an even whole number', () => {
    const canvas = document.createElement('div');
    box(canvas, { top: 56, bottom: 900 });
    const cluster = document.createElement('div');
    cluster.setAttribute('data-zoom-cluster', '');
    box(cluster, { top: 836.5, bottom: 884 });
    document.body.append(canvas, cluster);
    const inset = bottomClusterInset(canvas);
    expect(inset % 2).toBe(0);
    expect(inset).toBeGreaterThanOrEqual(900 - 836.5 + BOTTOM_CLUSTER_GAP);
    expect(inset).toBeLessThan(900 - 836.5 + BOTTOM_CLUSTER_GAP + 2);
  });
  it('is 0 with no controls, or controls hidden or outside the canvas', () => {
    const canvas = document.createElement('div');
    box(canvas, { top: 56, bottom: 900 });
    document.body.append(canvas);
    expect(bottomClusterInset(canvas)).toBe(0);
    const cluster = document.createElement('div');
    cluster.setAttribute('data-zoom-cluster', '');
    box(cluster, { top: 950, bottom: 990 });
    document.body.append(cluster);
    expect(bottomClusterInset(canvas)).toBe(0);
  });
});
