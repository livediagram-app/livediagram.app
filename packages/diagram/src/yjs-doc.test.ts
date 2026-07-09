import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { Element, Tab } from './index';
import {
  applyDiagramUpdate,
  applyElementOpToDoc,
  encodeDiagramUpdate,
  readDiagram,
  syncDiagram,
  writeDiagram,
} from './yjs-doc';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Tab 1',
  elements: [el('a'), el('b')],
  ...over,
});

function sync(from: Y.Doc, to: Y.Doc): void {
  applyDiagramUpdate(to, encodeDiagramUpdate(from));
}

describe('writeDiagram / readDiagram round-trip', () => {
  it('reproduces the tabs, in order, with element fields intact', () => {
    const doc = new Y.Doc();
    const tabs = [
      tab({
        id: 't1',
        name: 'One',
        backgroundColor: '#111',
        elements: [el('a', { x: 5 }), el('b')],
      }),
      tab({ id: 't2', name: 'Two', elements: [el('c')] }),
    ];
    writeDiagram(doc, tabs);
    expect(readDiagram(doc)).toEqual(tabs);
  });

  it('preserves z-order from the order array', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab({ elements: [el('a'), el('b'), el('c')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'reorder', ids: ['c', 'a', 'b'] });
    expect(readDiagram(doc)[0]!.elements.map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('applyElementOpToDoc', () => {
  it('adds an element at its z-index', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab({ elements: [el('a'), el('c')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'add', element: el('b', { x: 9 }), at: 1 });
    const els = readDiagram(doc)[0]!.elements;
    expect(els.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(els[1]).toEqual(el('b', { x: 9 }));
  });

  it('updates an element field', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab({ elements: [el('a')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'update', element: el('a', { x: 42 }) });
    expect(readDiagram(doc)[0]!.elements[0]).toEqual(el('a', { x: 42 }));
  });

  it('removes an element from both the map and the order', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab({ elements: [el('a'), el('b')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'remove', id: 'a' });
    expect(readDiagram(doc)[0]!.elements.map((e) => e.id)).toEqual(['b']);
  });

  it('is a safe no-op for an unknown tab', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab()]);
    expect(() => applyElementOpToDoc(doc, 'nope', { kind: 'remove', id: 'a' })).not.toThrow();
    expect(readDiagram(doc)).toEqual([tab()]);
  });
});

describe('syncDiagram (local-commit path)', () => {
  it('projects back to the committed tabs after an incremental sync', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab({ elements: [el('a'), el('b')] })]);
    // A later commit: edit a, drop b, add c, rename the tab.
    const next = [tab({ name: 'Renamed', elements: [el('a', { x: 7 }), el('c')] })];
    syncDiagram(doc, next);
    expect(readDiagram(doc)).toEqual(next);
  });

  it('adds and removes whole tabs, keeping tab order', () => {
    const doc = new Y.Doc();
    writeDiagram(doc, [tab({ id: 't1' }), tab({ id: 't2' })]);
    const next = [tab({ id: 't2' }), tab({ id: 't3' })];
    syncDiagram(doc, next);
    expect(readDiagram(doc).map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('touches only changed elements, so a peer edit to another element survives', () => {
    // Peer A and B share [x, y]. A commits an edit to x via syncDiagram; B
    // concurrently commits an edit to y. Both survive after the merge.
    const a = new Y.Doc();
    writeDiagram(a, [tab({ elements: [el('x', { x: 0 }), el('y', { y: 0 })] })]);
    const b = new Y.Doc();
    applyDiagramUpdate(b, encodeDiagramUpdate(a));

    syncDiagram(a, [tab({ elements: [el('x', { x: 99 }), el('y', { y: 0 })] })]);
    syncDiagram(b, [tab({ elements: [el('x', { x: 0 }), el('y', { y: 88 })] })]);

    applyDiagramUpdate(a, encodeDiagramUpdate(b));
    applyDiagramUpdate(b, encodeDiagramUpdate(a));

    expect(readDiagram(a)).toEqual(readDiagram(b));
    const [x, y] = readDiagram(a)[0]!.elements;
    expect((x as { x: number }).x).toBe(99);
    expect((y as { y: number }).y).toBe(88);
  });
});

describe('CRDT merge (the Level 2 win)', () => {
  it('merges concurrent edits to DIFFERENT fields of the SAME element', () => {
    // Two peers start from the same state.
    const a = new Y.Doc();
    writeDiagram(a, [tab({ elements: [el('x', { x: 0, y: 0 })] })]);
    const b = new Y.Doc();
    sync(a, b);

    // A moves x; B moves y — same element, different fields, concurrently.
    applyElementOpToDoc(a, 't1', { kind: 'update', element: el('x', { x: 100, y: 0 }) });
    applyElementOpToDoc(b, 't1', { kind: 'update', element: el('x', { x: 0, y: 200 }) });

    // Exchange updates both ways; both fields survive on both peers.
    const ua = encodeDiagramUpdate(a);
    const ub = encodeDiagramUpdate(b);
    applyDiagramUpdate(a, ub);
    applyDiagramUpdate(b, ua);

    const xa = readDiagram(a)[0]!.elements[0]!;
    const xb = readDiagram(b)[0]!.elements[0]!;
    expect(xa).toEqual(xb); // converged
    expect((xa as { x: number }).x).toBe(100);
    expect((xa as { y: number }).y).toBe(200);
  });

  it('converges when two peers add different elements to the same tab', () => {
    const a = new Y.Doc();
    writeDiagram(a, [tab({ elements: [] })]);
    const b = new Y.Doc();
    sync(a, b);

    applyElementOpToDoc(a, 't1', { kind: 'add', element: el('p'), at: 0 });
    applyElementOpToDoc(b, 't1', { kind: 'add', element: el('q'), at: 0 });

    applyDiagramUpdate(a, encodeDiagramUpdate(b));
    applyDiagramUpdate(b, encodeDiagramUpdate(a));

    const ida = readDiagram(a)[0]!
      .elements.map((e) => e.id)
      .sort();
    const idb = readDiagram(b)[0]!
      .elements.map((e) => e.id)
      .sort();
    expect(ida).toEqual(['p', 'q']);
    expect(idb).toEqual(['p', 'q']);
  });
});
