// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  createImage,
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  participantTabChange,
  type Element,
  type Tab,
} from '@livediagram/document';
import { CANVAS_TOOLS } from '@/lib/editor-commands';
import {
  mayHoldBaton,
  resolveEditorCapabilities,
  roleGates,
  type EditorCapabilities,
} from '@/lib/editor-capabilities';
import { PARTICIPANT_CANVAS_TOOLS, participantTiles } from '@/components/palette/palette-layouts';
import { useViewPreview } from '@/app/document/[id]/useViewPreview';

// docs/specs/013-workspace/share-roles.md "The levels" and "What a Participant changes", as the editor renders
// them: one block per row of the two tables, one case per level. The room's half is apps/api/src/share-roles.test.ts.
// Each level's session is what useParticipantSession and useViewPreview give it: `can` for its level, and
// `isReadOnly` (`!canEdit`) true below an Editor. A Participant holds the adder key its room ticket carries.

type Level = 'edit' | 'participate' | 'view';
const LEVELS: readonly Level[] = ['edit', 'participate', 'view'];
const ADDER = 'a'.repeat(32);
const THEM = 'b'.repeat(32);
const el = (e: unknown, extra: Record<string, unknown> = {}) =>
  ({ ...(e as object), ...extra }) as Element;

const sticky = (extra: Record<string, unknown> = {}) =>
  el(createSticky(0, 0), { id: 's', addedBy: THEM, ...extra });
const image = (extra: Record<string, unknown> = {}) =>
  el(createImage(0, 0), { id: 'i', addedBy: THEM, ...extra });
const text = (extra: Record<string, unknown> = {}) =>
  el(createText(0, 0), { id: 'x', addedBy: THEM, ...extra });
const table = el(createTable(0, 0), { id: 'tb', addedBy: THEM });
const square = (extra: Record<string, unknown> = {}) =>
  el(createShape('square', 0, 0), { id: 'sq', addedBy: THEM, ...extra });
const behaviour = el(createShape('session-button', 0, 0), { id: 'sb', addedBy: THEM });
const mindNode = el(createShape('mind-node', 0, 0), { id: 'mn', addedBy: THEM });
const connector = el(createPinnedArrow('sq', 'e', 's', 'w'), { id: 'ar', addedBy: THEM });

const canFor = (level: Level, adderKey: string | null = ADDER): EditorCapabilities =>
  resolveEditorCapabilities({ level, adderKey: level === 'participate' ? adderKey : null });
// Nobody else holds the baton.
const gatesFor = (level: Level) => roleGates(canFor(level), false);
// A read-only session (a Participant or a Viewer) gets the participant selection modes; an Editor every tool.
const toolsFor = (level: Level): readonly string[] => {
  const all = CANVAS_TOOLS.map((t) => t.id);
  return level === 'edit' ? all : all.filter((id) => PARTICIPANT_CANVAS_TOOLS.includes(id));
};
// A session's `isReadOnly`, read the way the editor reads it: through the view preview hook's `canEdit`.
const isReadOnlyFor = (level: Level) =>
  !renderHook(() => useViewPreview(level, () => {})).result.current.canEdit;

const expectPerLevel = (
  name: string,
  read: (level: Level) => unknown,
  want: Record<Level, unknown>,
) =>
  describe(name, () => {
    for (const level of LEVELS) {
      it(`${level}: ${String(want[level])}`, () => expect(read(level)).toEqual(want[level]));
    }
  });

const tab = (elements: Element[], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'Retro',
  elements,
  ...extra,
});

describe('share roles in the editor: the levels (docs/specs/013-workspace/share-roles.md "The levels")', () => {
  // `isReadOnly` is true below an Editor: every structural gate stays shut for a Participant and a Viewer.
  expectPerLevel('every structural gate (isReadOnly)', isReadOnlyFor, {
    edit: false,
    participate: true,
    view: true,
  });

  // Look, pan, zoom, point, laser, spotlight and follow need no write, so every tool a read-only role picks is
  // look-only; export is a read, with no gate.
  expectPerLevel(
    'Viewer: look, pan, zoom, laser, spotlight, follow',
    (level) => ['pan', 'laser', 'spotlight', 'select'].every((t) => toolsFor(level).includes(t)),
    { edit: true, participate: true, view: true },
  );

  expectPerLevel(
    'tools that change the board',
    (level) => toolsFor(level).some((id) => CANVAS_TOOLS.find((t) => t.id === id)?.mutates),
    { edit: true, participate: false, view: false },
  );

  // Comment, reply, resolve; answer polls; Q&A; react; quizzes; estimates; ideas; dots: `can.takePart`.
  describe('Take part: comment, answer, upvote, react, vote', () => {
    expectPerLevel('can.takePart', (level) => canFor(level).takePart, {
      edit: true,
      participate: true,
      view: false,
    });
    expectPerLevel('roleGates.takePart', (level) => gatesFor(level).takePart, {
      edit: true,
      participate: true,
      view: false,
    });
    it('the baton never stops anyone taking part', () => {
      for (const level of LEVELS) {
        expect(roleGates(canFor(level), true).takePart).toBe(canFor(level).takePart);
      }
    });
  });

  // Running a session is facilitation, an Editor's hat: start, end, reveal, clear, pace, Bring Focus.
  describe('Run a session: start, end, reveal, clear, pace, press Bring Focus', () => {
    expectPerLevel('with the baton free', (level) => gatesFor(level).run, {
      edit: true,
      participate: false,
      view: false,
    });
    it('an Editor while somebody else holds the baton: no', () => {
      expect(roleGates(canFor('edit'), true).run).toBe(false);
      // Configuring the board itself (an estimate's scale) is not the baton's.
      expect(roleGates(canFor('edit'), true).shape).toBe(true);
    });
    it('the gate follows the level, never isReadOnly: only an Editor runs', () => {
      for (const level of LEVELS) {
        expect(gatesFor(level).run).toBe(!isReadOnlyFor(level));
      }
    });
  });

  expectPerLevel('Configure the board: an estimate scale', (level) => gatesFor(level).shape, {
    edit: true,
    participate: false,
    view: false,
  });

  expectPerLevel('Hold the facilitator baton', (level) => mayHoldBaton(level), {
    edit: true,
    participate: false,
    view: false,
  });

  it('an unknown level holds no more than a Viewer', () => {
    expect(mayHoldBaton('admin')).toBe(false);
    expect(mayHoldBaton(undefined)).toBe(false);
  });
});

describe('share roles in the editor: what a Participant changes (share-roles.md)', () => {
  // Row 2: add a sticky, a text element or an image, and grow a mind map; nothing else.
  describe('Add a sticky, text or an image', () => {
    expectPerLevel('can.addContent', (level) => canFor(level).addContent, {
      edit: true,
      participate: true,
      view: false,
    });
    it('a Participant with no key yet adds nothing (the room would refuse it)', () => {
      expect(canFor('participate', null).addContent).toBe(false);
    });
    it("a Participant's palette holds only Sticky, Text and Image tiles, on every mode", () => {
      for (const mode of ['diagram', 'draw', 'workshop'] as const) {
        const types = participantTiles(mode, false).map((t) => t.action.type);
        for (const type of types) expect(['sticky', 'text', 'image']).toContain(type);
        expect(types).toContain('image');
      }
    });
  });

  // Row 3: write on any element: its text, a table's cells; never a Behaviour's words.
  describe('Write on any element', () => {
    expectPerLevel(
      "a sticky, a shape's label, text, a table's cells",
      (level) => [sticky(), square(), text(), table].map((e) => canFor(level).writeText(e)),
      {
        edit: [true, true, true, true],
        participate: [true, true, true, true],
        view: [false, false, false, false],
      },
    );
    expectPerLevel(
      'a Behaviour, a locked element',
      (level) => {
        return [behaviour, square({ locked: true })].map((e) => canFor(level).writeText(e));
      },
      {
        edit: [true, true],
        participate: [false, false],
        view: [false, false],
      },
    );
  });

  // Row 4: move and resize any sticky or image; recolour any sticky; move any mind node. Nothing else of
  // someone else's, text boxes included.
  describe('Move, resize, recolour', () => {
    expectPerLevel(
      "anyone's sticky and image, any mind node",
      (level) => {
        const can = canFor(level);
        return [
          can.move(sticky()),
          can.resize(sticky()),
          can.recolour(sticky()),
          can.move(image()),
          can.resize(image()),
          can.move(mindNode),
        ];
      },
      {
        edit: [true, true, true, true, true, true],
        participate: [true, true, true, true, true, true],
        view: [false, false, false, false, false, false],
      },
    );
    expectPerLevel(
      "someone else's shape or text box, and resizing or recolouring a mind node",
      (level) => {
        const can = canFor(level);
        return [
          can.move(square()),
          can.resize(square()),
          can.recolour(square()),
          can.move(text()),
          can.resize(text()),
          can.resize(mindNode),
          can.recolour(mindNode),
        ];
      },
      {
        edit: [true, true, true, true, true, true, true],
        participate: [false, false, false, false, false, false, false],
        view: [false, false, false, false, false, false, false],
      },
    );
    expectPerLevel(
      'a locked sticky',
      (level) => {
        const can = canFor(level);
        const locked = sticky({ locked: true });
        return [can.move(locked), can.resize(locked), can.recolour(locked)];
      },
      {
        edit: [true, true, true],
        participate: [false, false, false],
        view: [false, false, false],
      },
    );
  });

  // Row 5: delete what it added, and any mind node (with its connector); never someone else's.
  describe('Delete', () => {
    expectPerLevel(
      'its own work, a mind node',
      (level) => {
        const can = canFor(level);
        return [can.remove(sticky({ addedBy: ADDER })), can.remove(mindNode)];
      },
      { edit: [true, true], participate: [true, true], view: [false, false] },
    );
    expectPerLevel(
      "someone else's sticky, shape, text box, connector, or a locked own piece",
      (level) => {
        const can = canFor(level);
        return [
          can.remove(sticky()),
          can.remove(square()),
          can.remove(text()),
          can.remove(connector),
          can.remove(sticky({ addedBy: ADDER, locked: true })),
        ];
      },
      {
        edit: [true, true, true, true, true],
        participate: [false, false, false, false, false],
        view: [false, false, false, false, false],
      },
    );
  });

  // Row 6: change anything about what it added.
  expectPerLevel(
    'Change anything about what it added: size, style, text',
    (level) => {
      const can = canFor(level);
      const own = square({ addedBy: ADDER });
      return [
        can.move(own),
        can.resize(own),
        can.recolour(own),
        can.writeText(own),
        can.remove(own),
      ];
    },
    {
      edit: [true, true, true, true, true],
      participate: [true, true, true, true, true],
      view: [false, false, false, false, false],
    },
  );

  // Rows 6 and 7 (never) and the commit guard: a change the room would refuse never lands on a Participant's
  // screen (useParticipantSession.guardCommit is `participantTabChange` for a Participant, the commit untouched for
  // an Editor). Reorder layers, group, lock and undo's forbidden parts are among them.
  describe("The Participant's commit guard", () => {
    const board = () => tab([square(), sticky(), sticky({ id: 'own', addedBy: ADDER })]);
    const held = (after: Tab) => participantTabChange(board(), after, ADDER);
    it('lets a permitted change through', () => {
      const after = tab(board().elements.map((e) => (e.id === 's' ? { ...e, x: 300 } : e)));
      expect(held(after)).not.toBeNull();
    });
    it('holds back reordering layers', () => {
      expect(held(tab([...board().elements].reverse()))).toBeNull();
    });
    it("holds back undoing, or redoing, anyone else's change (a restored or removed piece of theirs)", () => {
      expect(held(tab(board().elements.filter((e) => e.id !== 's')))).toBeNull();
      expect(held(tab(board().elements.filter((e) => e.id !== 'own')))).not.toBeNull();
    });
    it('keeps grouping and locking as stored', () => {
      const grouped = tab(board().elements.map((e) => (e.id === 's' ? { ...e, groupId: 'g' } : e)));
      const after = held(grouped);
      expect(after === null || !JSON.stringify(after).includes('"groupId"')).toBe(true);
      const locked = tab(board().elements.map((e) => (e.id === 'sq' ? { ...e, locked: true } : e)));
      const kept = held(locked);
      expect(kept === null || !JSON.stringify(kept).includes('"locked":true')).toBe(true);
    });
    it('holds back adding a shape, a frame or a free connector', () => {
      for (const added of [
        el(createShape('square', 0, 0), { id: 'new-shape' }),
        el(createShape('frame', 0, 0), { id: 'new-frame' }),
        el(createPinnedArrow('sq', 'e', 's', 'w'), { id: 'new-arrow' }),
      ]) {
        expect(held(tab([...board().elements, added]))).toBeNull();
      }
    });
  });

  // Row 8: nothing about tabs, the mode, the theme, the canvas, tidy up or the document's name: every one of those is
  // a structural gate, `isReadOnly`, shut for a Participant and a Viewer (the editor never offers them), and the
  // room drops the ops (apps/api/src/share-roles.test.ts).
  expectPerLevel('Tabs, modes, themes, tidy up, the document name', isReadOnlyFor, {
    edit: false,
    participate: true,
    view: true,
  });
});
