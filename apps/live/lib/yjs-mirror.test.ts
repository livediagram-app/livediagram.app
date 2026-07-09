import { describe, it, expect } from 'vitest';
import type { Element, Tab } from '@livediagram/diagram';
import { YjsMirror } from './yjs-mirror';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', name: 'T', elements: [], ...over });

// Wire two mirrors so each one's local updates reach the other, the way the
// room relays `ydoc` ops between two browsers.
function link(a: YjsMirror, b: YjsMirror) {
  a.onLocalUpdate((u) => b.applyRemote(u));
  b.onLocalUpdate((u) => a.applyRemote(u));
}

describe('YjsMirror', () => {
  it('broadcasts the seed and a linked peer adopts it', () => {
    const a = new YjsMirror();
    const b = new YjsMirror();
    link(a, b);

    a.seedFromHydrate([tab({ elements: [el('x', { x: 1 })] })]);

    expect(a.isSeeded).toBe(true);
    expect(b.tabs()).toEqual([tab({ elements: [el('x', { x: 1 })] })]);
  });

  it('does not commit before it is seeded', () => {
    const a = new YjsMirror();
    let sent = 0;
    a.onLocalUpdate(() => sent++);
    a.commit([tab({ elements: [el('x')] })]);
    expect(sent).toBe(0);
    expect(a.tabs()).toEqual([]);
  });

  it('adopts a shared state without echoing it back', () => {
    const source = new YjsMirror();
    source.seedFromHydrate([tab({ elements: [el('x')] })]);
    const joiner = new YjsMirror();
    let echoed = 0;
    joiner.onLocalUpdate(() => echoed++);
    joiner.adoptSharedState(source.encodeState());
    expect(joiner.tabs()).toEqual([tab({ elements: [el('x')] })]);
    expect(echoed).toBe(0); // an adopted remote state is not rebroadcast
  });

  it('merges concurrent edits to different fields of the same element', () => {
    const a = new YjsMirror();
    a.seedFromHydrate([tab({ elements: [el('x', { x: 0, y: 0 })] })]);
    // The joiner shares a's exact doc history (as the room seed would give it).
    const b = new YjsMirror();
    b.adoptSharedState(a.encodeState());

    // TRUE concurrency: both commit from the shared x:0,y:0 state BEFORE either
    // sees the other's update. Buffer the updates, then exchange.
    const fromA: string[] = [];
    const fromB: string[] = [];
    a.onLocalUpdate((u) => fromA.push(u));
    b.onLocalUpdate((u) => fromB.push(u));

    a.commit([tab({ elements: [el('x', { x: 100, y: 0 })] })]); // A moves x only
    b.commit([tab({ elements: [el('x', { x: 0, y: 200 })] })]); // B moves y only

    for (const u of fromA) b.applyRemote(u);
    for (const u of fromB) a.applyRemote(u);

    expect(a.tabs()).toEqual(b.tabs()); // converged
    const x = a.tabs()[0]!.elements[0]!;
    expect((x as { x: number }).x).toBe(100);
    expect((x as { y: number }).y).toBe(200);
  });
});
