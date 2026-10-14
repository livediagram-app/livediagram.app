// A member moved out leaves no hole (docs/specs/024-agents/edit-operations.md "Layout on edit"): the frame that grew
// to hold it gives the room back, and what it pushed on comes back with it.
import { describe, expect, it } from 'vitest';
import {
  buildGraphTab,
  resolveGraphInput,
  type BoxedElement,
  type Tab,
} from '@livediagram/document';
import { applied, lines } from '../fixtures/outcomes';
import { run } from '../fixtures/run';

const architecture = (): Tab =>
  buildGraphTab(
    't',
    'T',
    resolveGraphInput({
      graph: {
        style: 'flow',
        direction: 'down',
        nodes: [
          { id: 'gw', label: 'Gateway' },
          { id: 'a', label: 'Service A' },
          { id: 'b', label: 'Service B' },
          { id: 'db', label: 'A DB', shape: 'cylinder' },
        ],
        edges: [
          { from: 'gw', to: 'a' },
          { from: 'gw', to: 'b' },
          { from: 'a', to: 'db' },
        ],
        groups: [{ id: 'svc', label: 'Services', members: ['a', 'b'] }],
      },
    }).graph!,
    undefined,
  ) as Tab;

const box = (tab: Tab, id: string) => tab.elements.find((e) => e.id === id) as BoxedElement;

describe('move out of a frame', () => {
  it('gives back the room the box took and brings back what it pushed on', () => {
    const start = architecture();
    const grown = applied(run('add square id=es label=Search below:b', start)).tab;
    expect(box(grown, 'svc').height).toBeGreaterThan(box(start, 'svc').height);
    const outcome = run('move es below:svc', grown);
    const { tab } = applied(outcome);
    expect(box(tab, 'svc')).toMatchObject({
      y: box(start, 'svc').y,
      height: box(start, 'svc').height,
    });
    expect(box(tab, 'db').y).toBe(box(start, 'db').y);
    expect(lines(outcome).some((l) => /shorter/.test(l))).toBe(true);
  });
});
