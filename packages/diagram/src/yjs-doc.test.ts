import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { Element, Tab } from './index';
import {
  applyDiagramUpdate,
  applyElementOpToDoc,
  encodeDiagramUpdate,
  mergeElements,
  readTabElements,
  syncElements,
  writeElements,
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

describe('writeElements / readTabElements', () => {
  it('round-trips a tab’s elements, in z-order', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ elements: [el('a', { x: 5 }), el('b'), el('c')] })]);
    expect(readTabElements(doc, 't1')).toEqual([el('a', { x: 5 }), el('b'), el('c')]);
  });

  it('returns null for a tab the doc has no element set for', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab()]);
    expect(readTabElements(doc, 'nope')).toBeNull();
  });

  it('preserves z-order from the order array after a reorder', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ elements: [el('a'), el('b'), el('c')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'reorder', ids: ['c', 'a', 'b'] });
    expect(readTabElements(doc, 't1')!.map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('mergeElements (the editor projection)', () => {
  it('fills each tab’s elements from the doc, keeping local meta + order', () => {
    const doc = new Y.Doc();
    writeElements(doc, [
      tab({ id: 't1', elements: [el('a', { x: 9 })] }),
      tab({ id: 't2', elements: [el('c')] }),
    ]);
    // Skeleton carries the tab meta/order the diagram-meta op owns; empty els.
    const skeleton = [
      tab({ id: 't1', name: 'Local One', backgroundColor: '#111', elements: [] }),
      tab({ id: 't2', name: 'Local Two', elements: [] }),
    ];
    expect(mergeElements(doc, skeleton)).toEqual([
      tab({ id: 't1', name: 'Local One', backgroundColor: '#111', elements: [el('a', { x: 9 })] }),
      tab({ id: 't2', name: 'Local Two', elements: [el('c')] }),
    ]);
  });

  it('leaves a tab untouched when the doc has no set for it', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ id: 't1', elements: [el('a')] })]);
    const skeleton = [tab({ id: 't2', name: 'Only local', elements: [el('z')] })];
    expect(mergeElements(doc, skeleton)).toEqual(skeleton);
  });
});

describe('applyElementOpToDoc', () => {
  it('adds an element at its z-index', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ elements: [el('a'), el('c')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'add', element: el('b', { x: 9 }), at: 1 });
    expect(readTabElements(doc, 't1')).toEqual([el('a'), el('b', { x: 9 }), el('c')]);
  });

  it('updates an element field', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ elements: [el('a')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'update', element: el('a', { x: 42 }) });
    expect(readTabElements(doc, 't1')![0]).toEqual(el('a', { x: 42 }));
  });

  it('removes an element from both the map and the order', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ elements: [el('a'), el('b')] })]);
    applyElementOpToDoc(doc, 't1', { kind: 'remove', id: 'a' });
    expect(readTabElements(doc, 't1')!.map((e) => e.id)).toEqual(['b']);
  });

  it('is a safe no-op for an unknown tab', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab()]);
    expect(() => applyElementOpToDoc(doc, 'nope', { kind: 'remove', id: 'a' })).not.toThrow();
    expect(readTabElements(doc, 't1')).toEqual([el('a'), el('b')]);
  });
});

describe('syncElements (local-commit path)', () => {
  it('projects back to the committed elements after an incremental sync', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ elements: [el('a'), el('b')] })]);
    syncElements(doc, [tab({ elements: [el('a', { x: 7 }), el('c')] })]); // edit a, drop b, add c
    expect(readTabElements(doc, 't1')).toEqual([el('a', { x: 7 }), el('c')]);
  });

  it('adds and removes whole tab element-sets', () => {
    const doc = new Y.Doc();
    writeElements(doc, [tab({ id: 't1' }), tab({ id: 't2' })]);
    syncElements(doc, [tab({ id: 't2' }), tab({ id: 't3', elements: [el('z')] })]);
    expect(readTabElements(doc, 't1')).toBeNull();
    expect(readTabElements(doc, 't3')).toEqual([el('z')]);
  });

  it('touches only changed elements, so a peer edit to another element survives', () => {
    const a = new Y.Doc();
    writeElements(a, [tab({ elements: [el('x', { x: 0 }), el('y', { y: 0 })] })]);
    const b = new Y.Doc();
    sync(a, b);

    syncElements(a, [tab({ elements: [el('x', { x: 99 }), el('y', { y: 0 })] })]);
    syncElements(b, [tab({ elements: [el('x', { x: 0 }), el('y', { y: 88 })] })]);

    applyDiagramUpdate(a, encodeDiagramUpdate(b));
    applyDiagramUpdate(b, encodeDiagramUpdate(a));

    expect(readTabElements(a, 't1')).toEqual(readTabElements(b, 't1'));
    const [x, y] = readTabElements(a, 't1')!;
    expect((x as { x: number }).x).toBe(99);
    expect((y as { y: number }).y).toBe(88);
  });
});

describe('CRDT merge (the Level 2 win)', () => {
  it('merges concurrent edits to DIFFERENT fields of the SAME element', () => {
    const a = new Y.Doc();
    writeElements(a, [tab({ elements: [el('x', { x: 0, y: 0 })] })]);
    const b = new Y.Doc();
    sync(a, b);

    applyElementOpToDoc(a, 't1', { kind: 'update', element: el('x', { x: 100, y: 0 }) });
    applyElementOpToDoc(b, 't1', { kind: 'update', element: el('x', { x: 0, y: 200 }) });

    applyDiagramUpdate(a, encodeDiagramUpdate(b));
    applyDiagramUpdate(b, encodeDiagramUpdate(a));

    const xa = readTabElements(a, 't1')![0]!;
    expect(readTabElements(a, 't1')).toEqual(readTabElements(b, 't1'));
    expect((xa as { x: number }).x).toBe(100);
    expect((xa as { y: number }).y).toBe(200);
  });

  it('converges when two peers add different elements to the same tab', () => {
    const a = new Y.Doc();
    writeElements(a, [tab({ elements: [] })]);
    const b = new Y.Doc();
    sync(a, b);

    applyElementOpToDoc(a, 't1', { kind: 'add', element: el('p'), at: 0 });
    applyElementOpToDoc(b, 't1', { kind: 'add', element: el('q'), at: 0 });

    applyDiagramUpdate(a, encodeDiagramUpdate(b));
    applyDiagramUpdate(b, encodeDiagramUpdate(a));

    expect(
      readTabElements(a, 't1')!
        .map((e) => e.id)
        .sort(),
    ).toEqual(['p', 'q']);
    expect(readTabElements(a, 't1')).toEqual(readTabElements(b, 't1'));
  });
});
