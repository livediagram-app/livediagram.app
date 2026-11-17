import { describe, expect, it } from 'vitest';
import { layoutGraph } from '@livediagram/document';
import { selectTasks, TASKS, taskById } from './index.mjs';

describe('the task bank', () => {
  it('has unique ids, a prompt and checks for every task', () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    for (const t of TASKS) {
      expect(t.prompt.length, t.id).toBeGreaterThan(20);
      expect(t.checks.length, t.id).toBeGreaterThanOrEqual(3);
      for (const [name, fn] of t.checks) {
        expect(typeof name, t.id).toBe('string');
        expect(typeof fn, `${t.id} ${name}`).toBe('function');
      }
    }
  });

  it('builds every edit task on a task that exists and is no edit itself', () => {
    for (const t of TASKS.filter((x) => x.after))
      expect(taskById(t.after).after, t.id).toBeUndefined();
  });

  it('selects all, an area or ids', () => {
    expect(selectTasks('all')).toHaveLength(TASKS.length);
    expect(selectTasks('workshop').map((t) => t.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'W1', 'W2']);
    expect(selectTasks('workshop,D1,F1').map((t) => t.id)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'W1',
      'W2',
      'D1',
    ]);
    expect(() => selectTasks('Z9')).toThrow('No task Z9');
  });
});

// D17's checks pass on the three C4 levels the graph's c4 style draws (docs/specs/015-api/mcp-server.md §4.7 `c4`), so
// an agent that uses it scores, with no coordinates.
describe('the C4 model task', () => {
  const level = (nodes: object[], groups?: object[]) =>
    layoutGraph({
      style: 'c4',
      nodes,
      edges: [{ from: (nodes[0] as { id: string }).id, to: (nodes[1] as { id: string }).id }],
      ...(groups ? { groups } : {}),
    } as Parameters<typeof layoutGraph>[0]);
  const tabs = [
    level([
      { id: 'c', label: 'Customer', c4Kind: 'person' },
      { id: 's', label: 'Internet banking system' },
    ]),
    level(
      [
        { id: 'c', label: 'Customer', c4Kind: 'person' },
        { id: 'w', label: 'Web app', group: 'ibs', tech: 'Angular' },
        { id: 'a', label: 'API application', group: 'ibs', tech: 'Java' },
      ],
      [{ id: 'ibs', label: 'Internet banking system' }],
    ),
    level(
      [
        { id: 'w', label: 'Web app', c4Kind: 'container' },
        { id: 'x', label: 'Sign-in controller', c4Kind: 'component', group: 'api' },
        { id: 'y', label: 'Accounts controller', c4Kind: 'component', group: 'api' },
        { id: 'z', label: 'Security component', c4Kind: 'component', group: 'api' },
      ],
      [{ id: 'api', label: 'API application' }],
    ),
  ];
  const snap = {
    documents: [{ id: 'd', tabs: tabs.map((elements, i) => ({ id: `t${i}`, elements })) }],
  };

  it('scores the levels the c4 style draws', () => {
    for (const [name, fn] of taskById('D17').checks) {
      const got = fn({ snap });
      expect(typeof got === 'object' ? got.pass : got, name).toBe(true);
    }
  });
});
