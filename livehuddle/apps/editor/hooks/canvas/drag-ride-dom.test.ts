// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRideWriter } from './drag-ride-dom';

// docs/specs/008-canvas/drag-preview.md "Moves ride an offset": the offsets go on every tagged node of each id.

function page() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  root.innerHTML =
    '<div data-ride-id="a"></div><svg><g data-ride-id="a"></g></svg><div data-ride-id="b"></div><div data-ride-id="c"></div>';
  const of = (id: string) =>
    [...root.querySelectorAll<HTMLElement>(`[data-ride-id="${id}"]`)].map((n) => n.style.translate);
  return { root, of };
}

describe('the ride writer', () => {
  it('shifts every node of each riding id, and puts back the ones that stop riding', () => {
    const { root, of } = page();
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(
      new Map([
        ['a', { dx: 4, dy: 2 }],
        ['b', { dx: 1, dy: 1 }],
      ]),
    );
    expect(of('a')).toEqual(['4px 2px', '4px 2px']);
    expect(of('b')).toEqual(['1px 1px']);
    expect(of('c')).toEqual(['']);
    expect(writer.active()).toBe(true);
    writer.apply(new Map([['a', { dx: 8, dy: 4 }]]));
    expect(of('a')).toEqual(['8px 4px', '8px 4px']);
    expect(of('b')).toEqual(['']);
    writer.apply(new Map());
    expect(of('a')).toEqual(['', '']);
    expect(writer.active()).toBe(false);
  });

  it('writes only what changed, and finds a node React put back in place of one it shifted', () => {
    const { root, of } = page();
    const writer = createRideWriter();
    writer.setRoot(root);
    const rides = new Map([['b', { dx: 3, dy: 0 }]]);
    writer.apply(rides);
    // A write the writer did not make survives a frame with the same offset: nothing is written.
    root.querySelector<HTMLElement>('[data-ride-id="b"]')!.style.translate = '9px 9px';
    writer.apply(rides);
    expect(of('b')).toEqual(['9px 9px']);
    // The node is replaced: the next frame finds the new one.
    const fresh = document.createElement('div');
    fresh.setAttribute('data-ride-id', 'b');
    root.querySelector('[data-ride-id="b"]')!.replaceWith(fresh);
    writer.apply(new Map([['b', { dx: 3, dy: 0 }]]));
    expect(fresh.style.translate).toBe('3px 0px');
  });

  it('does nothing without a root, and nothing when nothing rides', () => {
    const writer = createRideWriter();
    writer.apply(new Map());
    writer.apply(new Map([['a', { dx: 1, dy: 1 }]]));
    expect(writer.active()).toBe(true);
    writer.setRoot(null);
    writer.apply(new Map());
    expect(writer.active()).toBe(false);
  });
});
