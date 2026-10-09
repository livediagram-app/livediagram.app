import { describe, expect, it } from 'vitest';
import type { Element, Tab } from './index';
import {
  applyParticipantOp,
  participantTabChange,
  type ParticipantOpResult,
} from './participant-content';

// The participant content rule (docs/specs/013-workspace/share-roles.md "What a Participant changes").
const ME = 'a'.repeat(32);
const THEM = 'b'.repeat(32);
const box = { x: 10, y: 20, width: 120, height: 80 };

const sticky = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({ id, type: 'sticky', ...box, label: 'Went well', fillColor: '#fef08a', ...extra }) as Element;
const shape = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    ...box,
    label: 'Column',
    ...extra,
  }) as unknown as Element;
const table = (id: string): Element =>
  ({
    id,
    type: 'table',
    ...box,
    cells: [
      ['a', 'b'],
      ['c', 'd'],
    ],
  }) as Element;

function tabOf(elements: Element[], extra: Partial<Tab> = {}): Tab {
  return { id: 't1', name: 'Retro', elements, ...extra } as Tab;
}

function applied(r: ParticipantOpResult) {
  if (r.result !== 'applied') throw new Error(`refused: ${r.reason}`);
  return r;
}

describe('applyParticipantOp: add', () => {
  it('adds a sticky stamped with the adder key, at its place', () => {
    const tab = tabOf([shape('col'), sticky('s0')]);
    const r = applied(applyParticipantOp(tab, { kind: 'add', element: sticky('new'), at: 1 }, ME));
    expect(r.tab.elements.map((e) => e.id)).toEqual(['col', 'new', 's0']);
    expect(r.tab.elements[1]).toMatchObject({ addedBy: ME });
    expect(r.op).toMatchObject({ kind: 'add', at: 1, element: { addedBy: ME } });
    expect(r.changed).toBe(true);
  });

  it('adds text, overrides a claimed adder, and clamps its place', () => {
    const tab = tabOf([shape('col')]);
    const text = { id: 'tx', type: 'text', ...box, label: 'Hi', addedBy: THEM } as Element;
    const r = applied(applyParticipantOp(tab, { kind: 'add', element: text, at: 99 }, ME));
    expect(r.tab.elements.map((e) => e.id)).toEqual(['col', 'tx']);
    expect(r.tab.elements[1]).toMatchObject({ addedBy: ME });
  });

  it('strips a lock and any answers from what it adds', () => {
    const r = applied(
      applyParticipantOp(
        tabOf([]),
        {
          kind: 'add',
          element: sticky('n', { locked: true, commentThread: [{ id: 'c' }] }),
          at: 0,
        },
        ME,
      ),
    );
    expect(r.tab.elements[0]).not.toHaveProperty('locked');
    expect(r.tab.elements[0]).not.toHaveProperty('commentThread');
  });

  it('refuses a shape, and takes it back off the sender', () => {
    const r = applyParticipantOp(tabOf([]), { kind: 'add', element: shape('x'), at: 0 }, ME);
    expect(r).toEqual({
      result: 'refused',
      reason: 'not-addable',
      correction: { kind: 'remove', id: 'x' },
    });
  });

  it('refuses without an adder key', () => {
    for (const key of [null, '']) {
      const r = applyParticipantOp(tabOf([]), { kind: 'add', element: sticky('x'), at: 0 }, key);
      expect(r).toMatchObject({ result: 'refused', reason: 'no-adder' });
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

  it('refuses on a locked tab and onto a locked layer', () => {
    const locked = applyParticipantOp(
      tabOf([], { locked: true }),
      { kind: 'add', element: sticky('x'), at: 0 },
      ME,
    );
    expect(locked).toMatchObject({ result: 'refused', reason: 'tab-locked' });
    const layered = applyParticipantOp(
      tabOf([], { layers: [{ id: 'L', name: 'Frame', locked: true }] }),
      { kind: 'add', element: sticky('x', { layerId: 'L' }), at: 0 },
      ME,
    );
    expect(layered).toMatchObject({ result: 'refused', reason: 'locked' });
  });

  it('refuses a malformed element', () => {
    const bad = {
      id: 'x',
      type: 'sticky',
      x: 'left',
      y: 0,
      width: 1,
      height: 1,
    } as unknown as Element;
    expect(applyParticipantOp(tabOf([]), { kind: 'add', element: bad, at: 0 }, ME)).toMatchObject({
      result: 'refused',
      reason: 'invalid',
    });
  });
});

describe("applyParticipantOp: update someone else's element", () => {
  it('writes the words on a shape and keeps everything else as stored', () => {
    const stored = shape('col', { fillColor: '#fff' });
    const incoming = shape('col', {
      label: 'Start doing',
      richText: [{ text: 'Start doing' }],
      fillColor: '#000',
      width: 999,
      x: 500,
    });
    const r = applied(
      applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }, ME),
    );
    expect(r.tab.elements[0]).toEqual({
      ...stored,
      label: 'Start doing',
      richText: [{ text: 'Start doing' }],
    });
    // Peers get the words alone, never the stored size or colour over their own live copy.
    expect(r.op).toEqual({
      kind: 'patch',
      id: 'col',
      set: { label: 'Start doing', richText: [{ text: 'Start doing' }] },
    });
    expect(r.changed).toBe(true);
  });

  it('clears the words when the sender cleared them', () => {
    const r = applied(
      applyParticipantOp(
        tabOf([shape('col')]),
        { kind: 'update', element: { ...shape('col'), label: undefined } as Element },
        ME,
      ),
    );
    expect(r.tab.elements[0]).not.toHaveProperty('label');
  });

  it("moves and recolours anyone's sticky, never resizes it", () => {
    const stored = sticky('s', { addedBy: THEM });
    const r = applied(
      applyParticipantOp(
        tabOf([stored]),
        {
          kind: 'update',
          element: sticky('s', { x: 300, y: 40, fillColor: '#bae6fd', width: 400, addedBy: ME }),
        },
        ME,
      ),
    );
    expect(r.tab.elements[0]).toMatchObject({
      x: 300,
      y: 40,
      fillColor: '#bae6fd',
      width: 120,
      addedBy: THEM,
    });
  });

  it('keeps a stored place for a malformed position', () => {
    const r = applied(
      applyParticipantOp(
        tabOf([sticky('s')]),
        { kind: 'update', element: sticky('s', { x: Number.NaN, y: 55 }) },
        ME,
      ),
    );
    expect(r.tab.elements[0]).toMatchObject({ x: 10, y: 55 });
  });

  it("writes a table's cells only when its shape holds", () => {
    const tab = tabOf([table('tb')]);
    const words = applied(
      applyParticipantOp(
        tab,
        {
          kind: 'update',
          element: {
            ...table('tb'),
            cells: [
              ['x', 'b'],
              ['c', 'd'],
            ],
          } as Element,
        },
        ME,
      ),
    );
    expect((words.tab.elements[0] as { cells: string[][] }).cells[0]).toEqual(['x', 'b']);
    const grown = applied(
      applyParticipantOp(
        tab,
        {
          kind: 'update',
          element: {
            ...table('tb'),
            cells: [
              ['a', 'b'],
              ['c', 'd'],
              ['e', 'f'],
            ],
          } as Element,
        },
        ME,
      ),
    );
    expect(grown.changed).toBe(false);
  });

  it('lets a text box that hugs its words follow them, and no other', () => {
    const hug = { id: 'tx', type: 'text', ...box, label: 'Hi', sizing: 'fit' } as Element;
    const fixed = { id: 'fx', type: 'text', ...box, label: 'Hi' } as Element;
    const tab = tabOf([hug, fixed]);
    const grown = applied(
      applyParticipantOp(
        tab,
        { kind: 'update', element: { ...hug, label: 'Hello there', width: 200 } as Element },
        ME,
      ),
    );
    expect(grown.tab.elements[0]).toMatchObject({ label: 'Hello there', width: 200 });
    const kept = applied(
      applyParticipantOp(
        tab,
        { kind: 'update', element: { ...fixed, label: 'Hello', width: 200 } as Element },
        ME,
      ),
    );
    expect(kept.tab.elements[1]).toMatchObject({ label: 'Hello', width: 120 });
  });

  it('answers unchanged when nothing permitted moved', () => {
    const stored = shape('col');
    const r = applied(
      applyParticipantOp(
        tabOf([stored]),
        { kind: 'update', element: shape('col', { rotation: 45 }) },
        ME,
      ),
    );
    expect(r.changed).toBe(false);
    expect(r.tab.elements[0]).toBe(stored);
    expect(r.op).toEqual({ kind: 'patch', id: 'col', set: {} });
  });

  it('refuses a missing element, a changed type and a locked one', () => {
    expect(applyParticipantOp(tabOf([]), { kind: 'update', element: sticky('gone') }, ME)).toEqual({
      result: 'refused',
      reason: 'missing',
      correction: null,
    });
    const stored = shape('s');
    expect(
      applyParticipantOp(tabOf([stored]), { kind: 'update', element: sticky('s') }, ME),
    ).toEqual({
      result: 'refused',
      reason: 'type-changed',
      correction: { kind: 'update', element: stored },
    });
    const held = shape('h', { locked: true });
    expect(
      applyParticipantOp(
        tabOf([held]),
        { kind: 'update', element: shape('h', { label: 'x' }) },
        ME,
      ),
    ).toMatchObject({ result: 'refused', reason: 'locked' });
  });

  it('refuses everything on a locked tab', () => {
    const stored = sticky('s', { addedBy: ME });
    const tab = tabOf([stored], { locked: true });
    expect(
      applyParticipantOp(tab, { kind: 'update', element: sticky('s', { label: 'x' }) }, ME),
    ).toEqual({
      result: 'refused',
      reason: 'tab-locked',
      correction: { kind: 'update', element: stored },
    });
    expect(applyParticipantOp(tab, { kind: 'remove', id: 's' }, ME)).toEqual({
      result: 'refused',
      reason: 'tab-locked',
      correction: { kind: 'add', element: stored, at: 0 },
    });
  });
});

describe('applyParticipantOp: update its own element', () => {
  it('takes any field, keeping identity, adder and answers from stored', () => {
    const stored = sticky('mine', {
      addedBy: ME,
      responses: [{ participantId: 'p', value: '3', at: 1 }],
    });
    const r = applied(
      applyParticipantOp(
        tabOf([stored]),
        {
          kind: 'update',
          element: sticky('mine', {
            width: 300,
            textBold: true,
            addedBy: THEM,
            responses: [],
          }),
        },
        ME,
      ),
    );
    expect(r.tab.elements[0]).toMatchObject({
      width: 300,
      textBold: true,
      addedBy: ME,
      responses: [{ participantId: 'p', value: '3', at: 1 }],
    });
  });
});

describe('applyParticipantOp: what its own element may not become', () => {
  it('keeps its lock as stored, and clears a field it removed', () => {
    const stored = sticky('mine', { addedBy: ME, note: 'n' });
    const r = applied(
      applyParticipantOp(
        tabOf([stored]),
        { kind: 'update', element: sticky('mine', { addedBy: ME, locked: true }) },
        ME,
      ),
    );
    expect(r.tab.elements[0]).not.toHaveProperty('locked');
    expect(r.op).toEqual({ kind: 'patch', id: 'mine', set: {}, clear: ['note'] });
  });

  it('refuses moving it onto a locked layer', () => {
    const tab = tabOf([sticky('mine', { addedBy: ME })], {
      layers: [
        { id: 'layer:default', name: 'Layer 1' },
        { id: 'L', name: 'Frame', locked: true },
      ],
    });
    expect(
      applyParticipantOp(
        tab,
        { kind: 'update', element: sticky('mine', { addedBy: ME, layerId: 'L' }) },
        ME,
      ),
    ).toMatchObject({ result: 'refused', reason: 'locked' });
  });
});

describe('applyParticipantOp: remove and reorder', () => {
  it('removes what it added', () => {
    const r = applied(
      applyParticipantOp(
        tabOf([shape('col'), sticky('mine', { addedBy: ME })]),
        { kind: 'remove', id: 'mine' },
        ME,
      ),
    );
    expect(r.tab.elements.map((e) => e.id)).toEqual(['col']);
  });

  it("refuses to remove anyone else's, and puts it back where it was", () => {
    const theirs = sticky('theirs', { addedBy: THEM });
    const editors = sticky('editors');
    const tab = tabOf([shape('col'), theirs, editors]);
    expect(applyParticipantOp(tab, { kind: 'remove', id: 'theirs' }, ME)).toEqual({
      result: 'refused',
      reason: 'not-own',
      correction: { kind: 'add', element: theirs, at: 1 },
    });
    expect(applyParticipantOp(tab, { kind: 'remove', id: 'editors' }, ME)).toMatchObject({
      reason: 'not-own',
    });
    expect(applyParticipantOp(tab, { kind: 'remove', id: 'editors' }, null)).toMatchObject({
      reason: 'not-own',
    });
  });

  it('refuses to remove a locked element, even its own', () => {
    const r = applyParticipantOp(
      tabOf([sticky('mine', { addedBy: ME, locked: true })]),
      { kind: 'remove', id: 'mine' },
      ME,
    );
    expect(r).toMatchObject({ result: 'refused', reason: 'locked' });
  });

  it('refuses a missing element with nothing to restore', () => {
    expect(applyParticipantOp(tabOf([]), { kind: 'remove', id: 'x' }, ME)).toEqual({
      result: 'refused',
      reason: 'missing',
      correction: null,
    });
  });

  it('refuses every reorder, restoring the stored order', () => {
    const tab = tabOf([shape('a'), sticky('b', { addedBy: ME })]);
    expect(applyParticipantOp(tab, { kind: 'reorder', ids: ['b', 'a'] }, ME)).toEqual({
      result: 'refused',
      reason: 'reorder',
      correction: { kind: 'reorder', ids: ['a', 'b'] },
    });
  });
});

describe('participantTabChange', () => {
  const before = tabOf([shape('col'), sticky('theirs', { addedBy: THEM })]);

  it('stamps what it adds and keeps permitted changes as they are', () => {
    const after = tabOf([
      shape('col', { label: 'Start' }),
      sticky('theirs', { addedBy: THEM, x: 99 }),
      sticky('new'),
    ]);
    const out = participantTabChange(before, after, ME);
    expect(out?.elements[2]).toMatchObject({ id: 'new', addedBy: ME });
    expect(out?.elements[0]).toBe(after.elements[0]);
  });

  it('answers the same tab when nothing needed stamping', () => {
    const after = tabOf([shape('col', { label: 'Start' }), sticky('theirs', { addedBy: THEM })]);
    expect(participantTabChange(before, after, ME)).toBe(after);
  });

  it('refuses anything the room would refuse or trim', () => {
    // Somebody else's sticky deleted.
    expect(participantTabChange(before, tabOf([shape('col')]), ME)).toBeNull();
    // A shape resized.
    expect(
      participantTabChange(
        before,
        tabOf([shape('col', { width: 500 }), sticky('theirs', { addedBy: THEM })]),
        ME,
      ),
    ).toBeNull();
    // A shape added.
    expect(participantTabChange(before, tabOf([...before.elements, shape('x')]), ME)).toBeNull();
    // Reordered.
    expect(participantTabChange(before, tabOf([...before.elements].reverse()), ME)).toBeNull();
    // The tab's own settings.
    expect(participantTabChange(before, { ...before, name: 'Renamed' }, ME)).toBeNull();
    // An add without a key.
    expect(participantTabChange(before, tabOf([...before.elements, sticky('n')]), null)).toBeNull();
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
