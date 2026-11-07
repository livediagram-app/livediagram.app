import { describe, expect, it } from 'vitest';
import { createFreehand, createImage } from './factories';
import type { Element, Tab } from './index';
import {
  addedByAdder,
  applyParticipantOp,
  participantTabChange,
  type ParticipantOpResult,
} from './participant-content';

// The participant content rule (docs/specs/013-workspace/share-roles.md "A Participant walks"): a Participant adds,
// writes, moves and removes nothing; it changes an element only through a piece (a Door, its notes on a Notice Board).
const ME = 'a'.repeat(32);
const THEM = 'b'.repeat(32);
const box = { x: 10, y: 20, width: 120, height: 80 };

const sticky = (id: string, extra: Record<string, unknown> = {}): Element => ({
  id,
  type: 'sticky',
  ...box,
  label: 'Went well',
  fillColor: '#fef08a',
  ...extra,
});
const shape = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    ...box,
    label: 'Column',
    ...extra,
  }) as unknown as Element;
const table = (id: string): Element => ({
  id,
  type: 'table',
  ...box,
  cells: [
    ['a', 'b'],
    ['c', 'd'],
  ],
});

function tabOf(elements: Element[], extra: Partial<Tab> = {}): Tab {
  return { id: 't1', name: 'Retro', elements, ...extra };
}

function applied(r: ParticipantOpResult) {
  if (r.result !== 'applied') throw new Error(`refused: ${r.reason}`);
  return r;
}

describe('applyParticipantOp: add', () => {
  it('refuses every add, a sticky, text, image or shape alike, and takes it back off the sender', () => {
    const elements: Element[] = [
      sticky('s'),
      { id: 'tx', type: 'text', ...box, label: 'Hi' },
      { ...createImage(0, 0), id: 'i' },
      shape('x'),
      {
        ...createFreehand(
          [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
          ],
          false,
        ),
        id: 'f',
      },
    ];
    for (const el of elements) {
      for (const key of [ME, null]) {
        expect(applyParticipantOp(tabOf([]), { kind: 'add', element: el, at: 0 }, key)).toEqual({
          result: 'refused',
          reason: 'not-addable',
          correction: { kind: 'remove', id: el.id },
        });
      }
    }
  });

  it('refuses an id already on the tab, restoring nothing', () => {
    const r = applyParticipantOp(
      tabOf([shape('x')]),
      { kind: 'add', element: sticky('x'), at: 0 },
      ME,
    );
    expect(r).toEqual({ result: 'refused', reason: 'id-taken', correction: null });
  });
});

describe('applyParticipantOp: update', () => {
  it("keeps every content field of anyone's element as stored: words, place, size, colour, cells, picture", () => {
    const img = { ...createImage(0, 0), id: 'i', imageId: 'old' } as Element;
    const cases: [Element, Record<string, unknown>][] = [
      [shape('col'), { label: 'Start', x: 400, width: 300, fillColor: '#000000' }],
      [sticky('s', { addedBy: THEM }), { label: 'Nope', x: 99, fillColor: '#bbf7d0' }],
      [
        table('tb'),
        {
          cells: [
            ['x', 'y'],
            ['z', 'w'],
          ],
        },
      ],
      [
        { id: 'tx', type: 'text', ...box, label: 'Hi' },
        { label: 'Longer words', width: 400 },
      ],
      [img, { imageId: 'new', naturalWidth: 640, width: 5 }],
    ];
    for (const [stored, change] of cases) {
      const r = applied(
        applyParticipantOp(
          tabOf([stored]),
          { kind: 'update', element: { ...stored, ...change } },
          ME,
        ),
      );
      expect(r.changed, stored.id).toBe(false);
      expect(r.tab.elements[0], stored.id).toEqual(stored);
    }
  });

  it('treats its own earlier sticky no differently: it no longer writes on, moves or recolours it', () => {
    const mine = sticky('m', { addedBy: ME });
    const r = applied(
      applyParticipantOp(
        tabOf([mine]),
        {
          kind: 'update',
          element: { ...mine, label: 'Edited', x: 300, fillColor: '#bbf7d0' } as Element,
        },
        ME,
      ),
    );
    expect(r.changed).toBe(false);
    expect(r.tab.elements[0]).toEqual(mine);
  });

  it('refuses a missing element and a changed type', () => {
    expect(
      applyParticipantOp(tabOf([]), { kind: 'update', element: sticky('gone') }, ME),
    ).toMatchObject({ result: 'refused', reason: 'missing', correction: null });
    expect(
      applyParticipantOp(tabOf([sticky('s')]), { kind: 'update', element: shape('s') }, ME),
    ).toMatchObject({ result: 'refused', reason: 'type-changed' });
  });
});

describe('applyParticipantOp: remove and reorder', () => {
  it('removes nothing, its own earlier sticky included, and puts it back where it was', () => {
    for (const el of [
      sticky('mine', { addedBy: ME }),
      sticky('theirs', { addedBy: THEM }),
      shape('col'),
    ]) {
      const tab = tabOf([shape('a'), el]);
      expect(applyParticipantOp(tab, { kind: 'remove', id: el.id }, ME)).toEqual({
        result: 'refused',
        reason: 'not-own',
        correction: { kind: 'add', element: el, at: 1 },
      });
    }
  });

  it('refuses a missing element with nothing to restore', () => {
    expect(applyParticipantOp(tabOf([]), { kind: 'remove', id: 'x' }, ME)).toEqual({
      result: 'refused',
      reason: 'missing',
      correction: null,
    });
  });

  it('refuses every reorder, restoring the stored order', () => {
    const tab = tabOf([shape('a'), sticky('b')]);
    expect(applyParticipantOp(tab, { kind: 'reorder', ids: ['b', 'a'] }, ME)).toEqual({
      result: 'refused',
      reason: 'reorder',
      correction: { kind: 'reorder', ids: ['a', 'b'] },
    });
  });
});

describe('participantTabChange', () => {
  const before = tabOf([
    shape('col'),
    sticky('theirs', { addedBy: THEM }),
    sticky('mine', { addedBy: ME }),
  ]);

  it('answers the same tab when nothing changed', () => {
    expect(participantTabChange(before, before, ME)).toBe(before);
  });

  it('refuses every content change: an add, a delete, a word, a move, an order, the tab', () => {
    const [col, theirs, mine] = before.elements as [Element, Element, Element];
    const changes: Tab[] = [
      tabOf([...before.elements, sticky('new')]),
      tabOf([...before.elements, { id: 'tx', type: 'text', ...box, label: 'Hi' }]),
      tabOf([col, theirs]),
      tabOf([shape('col', { label: 'Start' }), theirs, mine]),
      tabOf([col, sticky('theirs', { addedBy: THEM, x: 99 }), mine]),
      tabOf([col, theirs, sticky('mine', { addedBy: ME, label: 'Edited' })]),
      tabOf([...before.elements].reverse()),
      { ...before, name: 'Renamed' },
    ];
    for (const after of changes) expect(participantTabChange(before, after, ME)).toBeNull();
  });
});

// docs/specs/009-elements/room-builder.md "Opening and closing": a Participant swings any door, and only that.
describe('a Participant and a Door', () => {
  const door = (extra: Record<string, unknown> = {}) =>
    shape('door', { shape: 'door', label: undefined, ...extra });
  const before = tabOf([door()]);

  it('opens and closes it', () => {
    const closed = participantTabChange(before, tabOf([door({ doorClosed: true })]), ME);
    expect(closed?.elements[0]).toMatchObject({ doorClosed: true });
    const open = participantTabChange(tabOf([door({ doorClosed: true })]), before, ME);
    expect(open?.elements[0]).not.toHaveProperty('doorClosed');
  });

  it('moves, resizes or deletes nothing about it', () => {
    expect(participantTabChange(before, tabOf([door({ x: 400 })]), ME)).toBeNull();
    expect(
      participantTabChange(before, tabOf([door({ doorClosed: true, width: 40 })]), ME),
    ).toBeNull();
    expect(participantTabChange(before, tabOf([]), ME)).toBeNull();
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab Locking": a lock saved before locking left
  // holds nothing, on the door or on its tab.
  it('swings a door saved locked, on a tab saved locked', () => {
    const old = { ...tabOf([door({ locked: true })]), locked: true } as Tab;
    const swung = { ...tabOf([door({ locked: true, doorClosed: true })]), locked: true } as Tab;
    expect(participantTabChange(old, swung, ME)?.elements[0]).toMatchObject({ doorClosed: true });
    expect(
      applyParticipantOp(old, { kind: 'update', element: swung.elements[0]! }, ME),
    ).toMatchObject({ result: 'applied', changed: true });
  });
});

// docs/specs/013-workspace/share-roles.md: a copy is nobody's addition.
describe('copies drop the adder', () => {
  it("duplicateElements never carries addedBy, so a copy is not the Participant's to delete", async () => {
    const { duplicateElements } = await import('./duplicate');
    const { newElements } = duplicateElements(
      [sticky('s', { addedBy: ME })],
      new Set(['s']),
      10,
      10,
    );
    expect((newElements[0] as { addedBy?: string }).addedBy).toBeUndefined();
    expect(JSON.parse(JSON.stringify(newElements[0]))).not.toHaveProperty('addedBy');
  });
});

// docs/specs/013-workspace/share-roles.md "A Participant walks": the Notice Board is a piece it keeps. Unpinning its
// last note leaves the board with none.
describe('a Notice Board', () => {
  const note = { id: 'n1', text: 'Lunch at 1', author: 'Sam', by: ME, at: 1 };
  const board = (notes?: unknown[]) =>
    ({
      id: 'nb',
      type: 'shape',
      shape: 'notice-board',
      ...box,
      ...(notes ? { noticeNotes: notes } : {}),
    }) as unknown as Element;

  it('unpins its own last note', () => {
    const r = applyParticipantOp(
      tabOf([board([note])]),
      { kind: 'update', element: board([]) },
      ME,
    );
    expect(r.result).toBe('applied');
    expect(r.result === 'applied' && r.tab.elements[0]).not.toHaveProperty('noticeNotes');
  });

  it('knows what its key added, and nothing without one', () => {
    expect(addedByAdder(board(), ME)).toBe(false);
    expect(addedByAdder({ ...board(), addedBy: ME } as Element, ME)).toBe(true);
    expect(addedByAdder({ ...board(), addedBy: ME } as Element, null)).toBe(false);
    expect(addedByAdder({ ...board(), addedBy: '' } as Element, '')).toBe(false);
  });
});

// docs/specs/009-elements/team-pieces.md "Calendar Wall": a calendar's notes merge exactly as a board's.
describe('a Calendar Wall', () => {
  const mine = { id: 'n1', text: 'Offsite', author: 'Sam', by: ME, at: 1, day: '2026-11-20' };
  const theirs = { ...mine, id: 'n2', by: 'someone-else' };
  const calendar = (notes?: unknown[]) =>
    ({
      id: 'cal',
      type: 'shape',
      shape: 'calendar-wall',
      ...box,
      ...(notes ? { noticeNotes: notes } : {}),
    }) as unknown as Element;

  it('pins its own note to a day, and never one signed by another key', () => {
    const r = applyParticipantOp(
      tabOf([calendar()]),
      { kind: 'update', element: calendar([mine, theirs]) },
      ME,
    );
    expect(r.result).toBe('applied');
    const el = r.result === 'applied' ? (r.tab.elements[0] as { noticeNotes?: unknown[] }) : null;
    expect(el?.noticeNotes).toEqual([mine]);
  });

  it('unpins its own last note', () => {
    const r = applyParticipantOp(
      tabOf([calendar([mine])]),
      { kind: 'update', element: calendar([]) },
      ME,
    );
    expect(r.result).toBe('applied');
    expect(r.result === 'applied' && r.tab.elements[0]).not.toHaveProperty('noticeNotes');
  });
});
