import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livediagram/diagram';
import { remintElementIds } from './useTabImport';

// Duplicate Tab, the cross-diagram tab link and JSON import all re-mint ids.
// References between elements must follow the new ids, or the copy points
// back at the source tab.

const shape = (id: string, extra: Partial<ShapeElement> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...extra }) as Element;

describe('remintElementIds', () => {
  it('re-parents mind-map nodes and re-pairs portals onto the new ids', () => {
    const out = remintElementIds([
      shape('root'),
      shape('child', { mindParentId: 'root' }),
      shape('p1', { portalTarget: 'p2' }),
      shape('p2', { portalTarget: 'p1' }),
    ]) as ShapeElement[];
    const [root, child, p1, p2] = out;
    expect(root!.id).not.toBe('root');
    expect(child!.mindParentId).toBe(root!.id);
    expect(p1!.portalTarget).toBe(p2!.id);
    expect(p2!.portalTarget).toBe(p1!.id);
  });

  it('keeps element order, which is stacking order', () => {
    const out = remintElementIds([
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 1, y: 1 },
      } as Element,
      shape('s'),
    ]);
    expect(out.map((e) => e.type)).toEqual(['arrow', 'shape']);
  });
});
