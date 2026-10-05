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
