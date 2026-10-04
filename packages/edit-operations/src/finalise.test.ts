import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { lines } from './fixtures/outcomes';
import { run } from './fixtures/run';
import { containersBehindMembers } from './finalise';

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
