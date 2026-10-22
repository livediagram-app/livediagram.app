import { describe, expect, it } from 'vitest';
import type { Element } from '@livedesign/document';
import { applyEditOperations } from './apply';
import { containersBehindMembers } from './finalise';
import { validateEditOperations } from './parse-json';

const box = (id: string, x: number, y: number, size: number, shape = 'square'): Element =>
  ({ id, type: 'shape', shape, x, y, width: size, height: size }) as Element;

describe('containersBehindMembers', () => {
  it('moves each container directly before its earliest member, the inner ones first (I6)', () => {
    const elements = [
      box('a', 10, 10, 10),
      box('inner', 0, 0, 50, 'frame'),
      box('b', 30, 30, 10),
      box('outer', -10, -10, 200, 'frame'),
    ];
    expect(containersBehindMembers(elements).map((el) => el.id)).toEqual([
      'outer',
      'inner',
      'a',
      'b',
    ]);
  });

  it('leaves a container already behind its members as it is', () => {
    const elements = [box('frame', 0, 0, 100, 'frame'), box('a', 10, 10, 10)];
    expect(containersBehindMembers(elements)).toEqual(elements);
  });
});

describe('sticky border', () => {
  const note = {
    id: 'n',
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    label: 'Hi',
    fillColor: '#fde68a',
    textSize: 'md',
  };
  const after = (fields: Record<string, unknown>) => {
    const parsed = validateEditOperations([{ op: 'set', target: 'n', fields }]);
    if ('errors' in parsed) throw new Error('bad operations');
    const out = applyEditOperations(
      { id: 't', name: 'T', elements: [note as unknown as Element] },
      parsed.operations,
      {},
    );
    if ('errors' in out) throw new Error('rejected');
    return { el: out.tab.elements[0] as Element & { strokeColor?: string }, out };
  };

  it('keeps the border of a note whose fill the edit left alone, and reports only the label', () => {
    const { el, out } = after({ label: 'Who helped?' });
    expect(el.strokeColor).toBeUndefined();
    const line = out.results[0]!;
    expect('changes' in line && line.changes.map((c) => c.key)).toEqual(['label']);
  });

  it('gives a note a new fill the borderless look', () => {
    expect(after({ fillColor: '#bae6fd' }).el.strokeColor).toBe('transparent');
    // Named by its alias too.
    expect(after({ fill: '#bae6fd' }).el.strokeColor).toBe('transparent');
  });
});
