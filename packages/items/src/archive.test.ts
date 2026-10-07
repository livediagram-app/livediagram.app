import { describe, expect, it } from 'vitest';
import {
  isArchived,
  isFlagged,
  normaliseBoardSetup,
  projectBoard,
  quickFilterMatches,
} from './board';
import { validateFields } from './fields';
import { presetSetup } from './presets';
import { ALI, SAM, item } from './test-items';
import type { Item } from './item';

// docs/specs/026-plan/items.md "Archive"; docs/specs/026-plan/board-widgets.md quick filters.
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
    expect(quickFilterMatches({ due: { to: '2026-10-07' } }, a)).toBe(true);
    expect(quickFilterMatches({ due: { to: '2026-10-07' } }, b)).toBe(false);
    expect(quickFilterMatches({ due: { to: '2026-10-07' } }, item({ title: 'c' }))).toBe(false);
    // A window with a start, and the done status left out.
    expect(quickFilterMatches({ due: { from: '2026-10-08', to: '2026-10-30' } }, a)).toBe(false);
    expect(
      quickFilterMatches({ due: { to: '2026-10-07', doneStatus: String(a.fields['status']) } }, a),
    ).toBe(false);
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
    expect(statusLabel('in-review~ab12')).toBe('In Review');
    expect(statusLabel('ready-for-qa')).toBe('Ready for Qa');
  });
});

describe('column widths', () => {
  it('keep two or three slots, and read anything else as one', () => {
    const s = normaliseBoardSetup({
      columns: [
        { id: 'a', status: 'a', name: 'A', width: 3 },
        { id: 'b', status: 'b', name: 'B', width: 9 },
      ],
    });
    expect(s?.columns[0]!.width).toBe(3);
    expect(s?.columns[1]).not.toHaveProperty('width');
  });
});

describe('trash', () => {
  it('keeps trashed cards off every board, the unplaced list and All Cards', async () => {
    const { isTrashed } = await import('./board');
    const t = item({ title: 't', status: 'trash', trashedFrom: 'todo' });
    const live = item({ title: 'live', status: 'todo' });
    expect(isTrashed(t)).toBe(true);
    expect(
      projectBoard({ ...presetSetup('kanban'), swimlaneBy: 'none' }, map([t, live])).total,
    ).toBe(1);
    expect(projectBoard(presetSetup('kanban'), map([t])).unplaced).toHaveLength(0);
    expect(projectBoard(presetSetup('all-cards'), map([t, live])).total).toBe(1);
  });
});

describe('add types', () => {
  it('limit what a board takes new cards of, in the catalogue order', async () => {
    const { boardAddTypes } = await import('./board');
    const types = [{ id: 'project' }, { id: 'task' }, { id: 'note' }];
    expect(boardAddTypes({}, types).map((t) => t.id)).toEqual(['project', 'task', 'note']);
    expect(boardAddTypes({ addTypes: ['note', 'task'] }, types).map((t) => t.id)).toEqual([
      'task',
      'note',
    ]);
    // A retro takes notes and ideas; its actions go on a board of their own (plan-templates.md).
    expect(presetSetup('retro').addTypes).toEqual(['note', 'idea']);
    expect(presetSetup('retro').columns.map((c) => c.status)).toEqual([
      'went-well',
      'to-improve',
      'ideas',
    ]);
    expect(
      normaliseBoardSetup({ ...presetSetup('blank'), addTypes: ['task', 'task', 'Bad', 3] })
        ?.addTypes,
    ).toEqual(['task']);
  });
});

describe('add types after a type is deleted', () => {
  it('fall back to every type when none the board names is left, never an empty Add Card', async () => {
    const { boardAddTypes, boardTakesType } = await import('./board');
    const types = [{ id: 'project' }, { id: 'task' }, { id: 'note' }];
    // The board took only `customer-call` new cards; that type has since been deleted.
    const stale = { addTypes: ['customer-call'] };
    expect(boardAddTypes(stale, types).map((t) => t.id)).toEqual(['project', 'task', 'note']);
    expect(boardTakesType(stale, types, 'task')).toBe(true);
    // One named type left: only it, and the deleted id is ignored.
    const partial = { addTypes: ['customer-call', 'note'] };
    expect(boardAddTypes(partial, types).map((t) => t.id)).toEqual(['note']);
    expect(boardTakesType(partial, types, 'note')).toBe(true);
    expect(boardTakesType(partial, types, 'task')).toBe(false);
    expect(boardTakesType({}, types, 'project')).toBe(true);
  });
});

describe('board widths', () => {
  it('fit every column side by side', async () => {
    const { planBoardWidthFor, PLAN_COLUMN_MIN_PX } = await import('./board');
    expect(planBoardWidthFor({ columns: [] })).toBe(760);
    const six = presetSetup('kanban').columns.concat({ id: 'x', status: 'x', name: 'X', width: 2 });
    expect(planBoardWidthFor({ columns: six })).toBeGreaterThanOrEqual(7 * PLAN_COLUMN_MIN_PX);
  });
});

// docs/specs/026-plan/items.md "Flags": only `true` flags an item.
describe('flags', () => {
  it('reads only true as flagged', () => {
    const base = { fields: { title: 'x' } } as never;
    expect(isFlagged({ ...(base as object), fields: { flagged: true } } as never)).toBe(true);
    expect(isFlagged({ ...(base as object), fields: { flagged: 'yes' } } as never)).toBe(false);
    expect(isFlagged(base)).toBe(false);
  });
});
