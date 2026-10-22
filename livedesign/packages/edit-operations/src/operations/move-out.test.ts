// A member moved out leaves no hole (docs/specs/024-agents/edit-operations.md "Layout on edit"): the frame that grew
// to hold it gives the room back, and what it pushed on comes back with it.
import { describe, expect, it } from 'vitest';
import {
  buildGraphTab,
  resolveGraphInput,
  type BoxedElement,
  type Tab,
} from '@livedesign/document';
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
  );

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

  it('comes in on the side the box stretched it, reported narrower', () => {
    const grown = applied(run('add square id=es label=Search right-of:b', architecture())).tab;
    expect(box(grown, 'svc').width).toBeGreaterThan(box(architecture(), 'svc').width);
    const outcome = run('move es below:svc', grown);
    expect(box(applied(outcome).tab, 'svc').width).toBe(box(architecture(), 'svc').width);
    expect(lines(outcome).some((l) => /narrower/.test(l))).toBe(true);
  });

  it('leaves a locked container, and one left empty, at its size', () => {
    const grown = applied(run('add square id=es label=Search below:b', architecture())).tab;
    const locked: Tab = {
      ...grown,
      elements: grown.elements.map((e) => (e.id === 'svc' ? { ...e, locked: true } : e)),
    };
    expect(box(applied(run('move es below:svc', locked)).tab, 'svc').height).toBe(
      box(grown, 'svc').height,
    );
    const alone = applied(run('move a below:svc\nmove b below:a', architecture())).tab;
    expect(box(alone, 'svc').height).toBe(box(architecture(), 'svc').height);
  });
});
