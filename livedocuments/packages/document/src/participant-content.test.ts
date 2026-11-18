import { describe, expect, it } from 'vitest';
import { createImage } from './factories';
import type { Element, Tab } from './index';
import {
  applyParticipantOp,
  participantTabChange,
  type ParticipantOpResult,
} from './participant-content';

// The participant content rule (docs/specs/013-workspace/share-roles.md "What a Participant changes"): text only.
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
    shape: 'rectangle',
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

describe('applyParticipantOp: adds, removes and reorders', () => {
  it('refuses every add, and takes it back off the sender', () => {
    for (const el of [
      sticky('new'),
      shape('new'),
      { ...createImage(0, 0), id: 'new' } as Element,
    ]) {
      expect(applyParticipantOp(tabOf([]), { kind: 'add', element: el, at: 0 })).toEqual({
        result: 'refused',
        reason: 'not-addable',
        correction: { kind: 'remove', id: 'new' },
      });
    }
  });

  it('refuses an add over an id already on the tab, restoring nothing', () => {
    const r = applyParticipantOp(tabOf([sticky('s')]), {
      kind: 'add',
      element: sticky('s'),
      at: 0,
    });
    expect(r).toMatchObject({ result: 'refused', reason: 'not-addable', correction: null });
  });

  it('refuses every remove, and puts the element back where it was', () => {
    const stored = sticky('s');
    expect(applyParticipantOp(tabOf([shape('c'), stored]), { kind: 'remove', id: 's' })).toEqual({
      result: 'refused',
      reason: 'not-removable',
      correction: { kind: 'add', element: stored, at: 1 },
    });
  });

  it('refuses a remove of a missing element with nothing to restore', () => {
    expect(applyParticipantOp(tabOf([]), { kind: 'remove', id: 'gone' })).toEqual({
      result: 'refused',
      reason: 'missing',
      correction: null,
    });
  });

  it('refuses every reorder, restoring the stored order', () => {
    const tab = tabOf([shape('a'), sticky('b')]);
    expect(applyParticipantOp(tab, { kind: 'reorder', ids: ['b', 'a'] })).toEqual({
      result: 'refused',
      reason: 'reorder',
      correction: { kind: 'reorder', ids: ['a', 'b'] },
    });
  });
});

describe('applyParticipantOp: updates write text only', () => {
  it('writes the words on a shape and keeps everything else as stored', () => {
    const stored = shape('col', { fillColor: '#fff' });
    const incoming = shape('col', {
      label: 'Start doing',
      richText: [{ text: 'Start doing' }],
      fillColor: '#000',
      width: 999,
      x: 500,
      rotation: 45,
      locked: true,
    });
    const r = applied(applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }));
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
      applyParticipantOp(tabOf([shape('col')]), {
        kind: 'update',
        element: { ...shape('col'), label: undefined } as Element,
      }),
    );
    expect(r.tab.elements[0]).not.toHaveProperty('label');
  });

  it('writes on a sticky, never moving, resizing or recolouring it', () => {
    const stored = sticky('s');
    const r = applied(
      applyParticipantOp(tabOf([stored]), {
        kind: 'update',
        element: sticky('s', { label: 'Ship it', x: 300, width: 400, fillColor: '#bae6fd' }),
      }),
    );
    expect(r.tab.elements[0]).toEqual({ ...stored, label: 'Ship it' });
  });

  it("writes a table's cells only when its rows and columns hold", () => {
    const tab = tabOf([table('tb')]);
    const words = applied(
      applyParticipantOp(tab, {
        kind: 'update',
        element: {
          ...table('tb'),
          cells: [
            ['x', 'b'],
            ['c', 'd'],
          ],
        } as Element,
      }),
    );
    expect((words.tab.elements[0] as { cells: string[][] }).cells[0]).toEqual(['x', 'b']);
    for (const cells of [
      [
        ['a', 'b'],
        ['c', 'd'],
        ['e', 'f'],
      ],
      [
        ['a', 'b', 'x'],
        ['c', 'd', 'y'],
      ],
    ]) {
      const grown = applied(
        applyParticipantOp(tab, { kind: 'update', element: { ...table('tb'), cells } as Element }),
      );
      expect(grown.changed).toBe(false);
    }
  });

  it('lets a text box that hugs its words follow them, and no other, nor a shape', () => {
    const hug = { id: 'tx', type: 'text', ...box, label: 'Hi', sizing: 'fit' } as Element;
    const fixed = { id: 'fx', type: 'text', ...box, label: 'Hi' } as Element;
    const tab = tabOf([hug, fixed]);
    const grown = applied(
      applyParticipantOp(tab, {
        kind: 'update',
        element: { ...hug, label: 'Hello there', width: 200 } as Element,
      }),
    );
    expect(grown.tab.elements[0]).toMatchObject({ label: 'Hello there', width: 200 });
    const resized = applied(
      applyParticipantOp(tab, {
        kind: 'update',
        element: { ...fixed, label: 'Hello', width: 200 } as Element,
      }),
    );
    expect(resized.tab.elements[1]).toMatchObject({ label: 'Hello', width: 120 });
    const nudged = applied(
      applyParticipantOp(tab, { kind: 'update', element: { ...hug, x: 500 } as Element }),
    );
    expect(nudged.tab.elements[0]).toMatchObject({ x: 10 });
  });

  it("changes an image's words, never its picture or size", () => {
    const img = { ...createImage(0, 0), id: 'i1', imageId: 'old' } as Element;
    const r = applied(
      applyParticipantOp(tabOf([img]), {
        kind: 'update',
        element: { ...img, imageId: 'new', width: 5, alt: 'A harbour at dusk' } as Element,
      }),
    );
    expect(r.tab.elements[0]).toEqual({ ...img, alt: 'A harbour at dusk' });
  });

  // docs/specs/009-elements/images.md "Alt text": stored clean whoever writes it, and words that clean to nothing
  // remove it.
  it("cleans a Participant's alt text, and removes one that cleans to nothing", () => {
    const img = { ...createImage(0, 0), id: 'i1', imageId: 'pic', alt: 'Old' } as Element;
    const cleaned = applied(
      applyParticipantOp(tabOf([img]), {
        kind: 'update',
        element: { ...img, alt: ' \u202EA harbour\n at   dusk ' } as Element,
      }),
    );
    expect(cleaned.tab.elements[0]).toEqual({ ...img, alt: 'A harbour at dusk' });
    expect(cleaned.op).toEqual({ kind: 'patch', id: 'i1', set: { alt: 'A harbour at dusk' } });
    const emptied = applied(
      applyParticipantOp(tabOf([img]), {
        kind: 'update',
        element: { ...img, alt: '  \n ' } as Element,
      }),
    );
    expect('alt' in emptied.tab.elements[0]!).toBe(false);
    expect(emptied.op).toEqual({ kind: 'patch', id: 'i1', set: {}, clear: ['alt'] });
  });

  it('answers unchanged when no text moved', () => {
    const stored = shape('col');
    const r = applied(
      applyParticipantOp(tabOf([stored]), {
        kind: 'update',
        element: shape('col', { rotation: 45 }),
      }),
    );
    expect(r.changed).toBe(false);
    expect(r.tab.elements[0]).toBe(stored);
    expect(r.op).toEqual({ kind: 'patch', id: 'col', set: {} });
  });

  it('refuses a missing element, a changed type, a locked one and a malformed word', () => {
    expect(applyParticipantOp(tabOf([]), { kind: 'update', element: sticky('gone') })).toEqual({
      result: 'refused',
      reason: 'missing',
      correction: null,
    });
    const stored = shape('s');
    expect(applyParticipantOp(tabOf([stored]), { kind: 'update', element: sticky('s') })).toEqual({
      result: 'refused',
      reason: 'type-changed',
      correction: { kind: 'update', element: stored },
    });
    const held = shape('h', { locked: true });
    expect(
      applyParticipantOp(tabOf([held]), { kind: 'update', element: shape('h', { label: 'x' }) }),
    ).toMatchObject({ result: 'refused', reason: 'locked' });
    expect(
      applyParticipantOp(tabOf([stored]), { kind: 'update', element: shape('s', { label: 7 }) }),
    ).toMatchObject({ result: 'refused', reason: 'invalid' });
  });

  it('refuses everything on a locked tab', () => {
    const stored = sticky('s');
    const tab = tabOf([stored], { locked: true });
    expect(
      applyParticipantOp(tab, { kind: 'update', element: sticky('s', { label: 'x' }) }),
    ).toEqual({
      result: 'refused',
      reason: 'tab-locked',
      correction: { kind: 'update', element: stored },
    });
  });
});

describe('participantTabChange', () => {
  const before = tabOf([shape('col'), sticky('st')]);

  it('takes a change of words as it is', () => {
    const after = tabOf([shape('col', { label: 'Start' }), sticky('st', { label: 'Stop' })]);
    expect(participantTabChange(before, after)).toBe(after);
  });

  it('refuses anything the room would refuse or trim', () => {
    // Deleted.
    expect(participantTabChange(before, tabOf([shape('col')]))).toBeNull();
    // Moved or resized.
    expect(participantTabChange(before, tabOf([shape('col'), sticky('st', { x: 99 })]))).toBeNull();
    expect(
      participantTabChange(before, tabOf([shape('col', { width: 500 }), sticky('st')])),
    ).toBeNull();
    // Restyled, while also writing.
    expect(
      participantTabChange(
        before,
        tabOf([shape('col', { label: 'Start', fillColor: '#000' }), sticky('st')]),
      ),
    ).toBeNull();
    // Added.
    expect(participantTabChange(before, tabOf([...before.elements, sticky('n')]))).toBeNull();
    // Reordered.
    expect(participantTabChange(before, tabOf([...before.elements].reverse()))).toBeNull();
    // The tab's own settings.
    expect(participantTabChange(before, { ...before, name: 'Renamed' })).toBeNull();
  });
});

// docs/specs/009-elements/quote.md, stat-row.md and comparison-tables.md "Roles": a Participant writes a quote's words,
// name and role and a table's cells (a tick or a cross included), never a look, a photo, a highlight or a switch.
describe('applyParticipantOp: quotes, stat rows and comparison tables', () => {
  it("writes a quote's name and role, never its look or photo", () => {
    const stored = shape('q', { shape: 'quote', pageTitle: 'Sam', pageSubtitle: 'Lead' });
    const incoming = shape('q', {
      shape: 'quote',
      pageTitle: 'Jo',
      pageSubtitle: 'Founder',
      quoteLook: 'plain',
      imageId: 'img-1',
    });
    const r = applied(applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }));
    expect(r.tab.elements[0]).toEqual({ ...stored, pageTitle: 'Jo', pageSubtitle: 'Founder' });
  });

  it("never switches a stat row's count-up", () => {
    const stored = shape('s', { shape: 'stat-row', stats: [{ value: '1', caption: 'a' }] });
    const r = applyParticipantOp(tabOf([stored]), {
      kind: 'update',
      element: { ...stored, statCountUp: false } as Element,
    });
    expect(r.result === 'applied' ? r.tab.elements[0] : stored).not.toHaveProperty('statCountUp');
  });

  it('types a tick into a cell, never moving the highlight', () => {
    const stored = { ...table('t'), highlightColumn: 0 } as Element;
    const incoming = {
      ...table('t'),
      cells: [
        ['✓', 'b'],
        ['c', 'd'],
      ],
      highlightColumn: 1,
    } as Element;
    const r = applied(applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }));
    const t = r.tab.elements[0] as Extract<Element, { type: 'table' }>;
    expect(t.cells[0]![0]).toBe('✓');
    expect(t.highlightColumn).toBe(0);
  });
});
