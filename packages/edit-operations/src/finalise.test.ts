import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { lines } from './fixtures/outcomes';
import { run } from './fixtures/run';
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

  it('leaves a container already behind its members, and a mind map as it is', () => {
    const elements = [box('frame', 0, 0, 100, 'frame'), box('a', 10, 10, 10)];
    expect(containersBehindMembers(elements)).toEqual(elements);
    const mind = [
      { ...box('child', 0, 0, 10, 'mind-node'), mindParentId: 'root' } as Element,
      box('root', 50, 0, 10, 'mind-node'),
    ];
    expect(containersBehindMembers(mind).map((el) => el.id)).toEqual(['child', 'root']);
  });
});

describe('workshop landings', () => {
  const note = (id: string, x: number, y: number): Element =>
    ({
      id,
      type: 'sticky',
      x,
      y,
      width: 200,
      height: 200,
      esKind: 'domain-event',
      fillColor: '#fdba74',
      fixedSize: true,
    }) as Element;
  const wall = (): Tab => ({
    id: 'es',
    name: 'Wall',
    kind: 'event-storming',
    elements: [
      box('area', -100, -100, 1400, 'frame'),
      note('carried', 0, 0),
      note('named', 400, 0),
    ],
  });

  it('reports a note carried off its lane as landed on a lane', () => {
    expect(lines(run('move area by=0,290', wall()))).toEqual([
      '~ area  @0,0→@0,290',
      '» carried named  landed on a lane',
    ]);
  });

  it('prints a note an operation moved itself as its own change', () => {
    expect(lines(run('move named by=0,37', wall()))).toEqual([]);
  });
});

describe('agenda fit', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ label: `Step ${i + 1}`, minutes: 15 }));
  const apply = (tab: Tab, operations: unknown[]) => {
    const parsed = validateEditOperations(operations);
    if ('errors' in parsed) throw new Error('bad operations');
    const out = applyEditOperations(tab, parsed.operations, {});
    if ('errors' in out) throw new Error(JSON.stringify(out.errors));
    return out.tab.elements.find((el) => el.id === 'ag')!;
  };
  const empty: Tab = { id: 't', name: 'T', elements: [] };
  const added = {
    id: 'ag',
    type: 'shape',
    shape: 'agenda',
    x: 0,
    y: 0,
    width: 440,
    height: 300,
    agendaItems: eight,
  };

  it('grows an added agenda down to draw every segment, keeping its top', () => {
    const el = apply(empty, [{ op: 'add', element: added }]);
    expect(el.type === 'shape' && [el.y, el.height > 300]).toEqual([0, true]);
    const roomy = apply(empty, [{ op: 'add', element: { ...added, height: 900 } }]);
    expect(roomy.type === 'shape' && roomy.height).toBe(900);
  });

  it('grows an agenda given more segments, but not one only moved', () => {
    const tab: Tab = { ...empty, elements: [{ ...added, agendaItems: [] } as unknown as Element] };
    const grown = apply(tab, [{ op: 'set', target: 'ag', fields: { agendaItems: eight } }]);
    expect(grown.type === 'shape' && grown.height).toBeGreaterThan(300);
    const tall: Tab = { ...empty, elements: [added as unknown as Element] };
    const moved = apply(tall, [{ op: 'set', target: 'ag', fields: { x: 50 } }]);
    expect(moved.type === 'shape' && moved.height).toBe(300);
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
