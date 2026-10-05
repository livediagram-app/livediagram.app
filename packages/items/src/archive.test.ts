import { describe, expect, it } from 'vitest';
import { isArchived, normaliseBoardSetup, projectBoard, quickFilterMatches } from './board';
import { validateFields } from './fields';
import { presetSetup } from './presets';
import { ALI, SAM, item } from './test-items';
import type { Item } from './item';

// docs/specs/025-plan/items.md "Archive"; docs/specs/025-plan/board-widgets.md quick filters.
const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe('archive', () => {
  const live = item({ title: 'live', status: 'todo' });
  const gone = item({ title: 'gone', status: 'todo', archived: true });
  const goneOff = item({ title: 'gone off', status: 'nowhere', archived: true });

  it('leaves archived items off an ordinary board, counts included', () => {
    const p = projectBoard(
      { ...presetSetup('kanban'), swimlaneBy: 'none' },
      map([live, gone, goneOff]),
    );
    expect(p.total).toBe(1);
    expect(p.unplaced).toHaveLength(0);
    expect(isArchived(gone)).toBe(true);
  });

  it('shows only archived items on an Archive board, all in its column', () => {
    const p = projectBoard(presetSetup('archive'), map([live, gone, goneOff]));
    expect(p.total).toBe(2);
    expect(p.columns[0]!.lanes[0]!.items.map((i) => i.fields['title']).sort()).toEqual([
      'gone',
      'gone off',
    ]);
    expect(p.unplaced).toHaveLength(0);
  });

  it('keeps the archive flag through the set-up check, and stores archived as true only', () => {
    expect(normaliseBoardSetup(presetSetup('archive'))?.archive).toBe(true);
    expect(normaliseBoardSetup({ ...presetSetup('kanban'), archive: 'yes' })).not.toHaveProperty(
      'archive',
    );
    expect(validateFields({ archived: true }, 'patch')).toEqual({
      ok: true,
      fields: { archived: true },
    });
    expect(validateFields({ archived: false }, 'patch').ok).toBe(false);
  });
});

describe('widget quick filters', () => {
  const a = item({ title: 'a', status: 'todo', assignee: SAM, due: '2026-10-01' });
  const b = item(
    { title: 'b', status: 'todo', assignee: ALI, due: '2026-10-20' },
    { type: 'note' },
  );
  it('narrows to a person, a type, or what is due by a day', () => {
    expect(quickFilterMatches({ person: SAM.id }, a)).toBe(true);
    expect(quickFilterMatches({ person: SAM.id }, b)).toBe(false);
    expect(quickFilterMatches({ type: 'note' }, b)).toBe(true);
    expect(quickFilterMatches({ type: 'note' }, a)).toBe(false);
    expect(quickFilterMatches({ dueBy: '2026-10-07' }, a)).toBe(true);
    expect(quickFilterMatches({ dueBy: '2026-10-07' }, b)).toBe(false);
    expect(quickFilterMatches({ dueBy: '2026-10-07' }, item({ title: 'c' }))).toBe(false);
  });
});

describe('fresh boards and All Cards', () => {
  it('gives a placed board statuses of its own, so it starts empty', async () => {
    const { freshBoardSetup } = await import('./presets');
    const s = freshBoardSetup('kanban', () => 0.5);
    expect(s.columns.every((c) => /~[a-z0-9]{4}$/.test(c.status))).toBe(true);
    const p = projectBoard(s, map([item({ title: 'old', status: 'todo' })]));
    expect(p.total).toBe(0);
    expect(freshBoardSetup('archive').columns[0]!.status).toBe('archived');
  });

  it('shows every card on an All Cards board, a row per status named by the tab', async () => {
    const { statusLabel } = await import('./board');
    const a = item({ title: 'a', status: 'todo~x1y2' });
    const b = item({ title: 'b', status: 'done' });
    const c = item({ title: 'c', status: 'todo', archived: true });
    const names = new Map([
      ['todo~x1y2', 'To do'],
      ['doing', 'In progress'],
      ['done', 'Done'],
    ]);
    const p = projectBoard(presetSetup('all-cards'), map([a, b, c]), undefined, undefined, names);
    expect(p.total).toBe(2);
    expect(p.lanes.map((l) => l.label)).toEqual(['To do', 'In progress', 'Done']);
    expect(statusLabel('in-review~ab12')).toBe('In review');
  });
});
