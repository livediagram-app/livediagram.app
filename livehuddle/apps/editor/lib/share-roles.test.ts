import { describe, expect, it } from 'vitest';
import { elementSupportsText, type Element } from '@livehuddle/document';
import { CANVAS_TOOLS } from '@/lib/editor-commands';
import {
  mayHoldBaton,
  resolveEditorCapabilities,
  roleGates,
  type EditorCapabilities,
} from '@/lib/editor-capabilities';
import {
  PARTICIPANT_CANVAS_TOOLS,
  paletteCategoriesFor,
  participantPaletteCategories,
} from '@/components/palette/palette-layouts';
import { buildCanvasToolOptions } from '@/components/palette/canvas-tool-options';
import { tilesForCategory } from '@/components/palette/palette-tile-defs';
import { avatarTourSteps } from '@/components/tour/avatar-tour-steps';

// docs/specs/013-workspace/share-roles.md "Feature by feature (v1)", as the editor renders it: one block per row of
// the table, one case per level. The room's half is apps/api/src/share-roles.test.ts. Each level's session is what
// useParticipantSession and useViewPreview give it: `can` for its level, and `isReadOnly` (`!canEdit`) true below an
// Editor. A Participant holds the adder key its room ticket carries.

type Level = 'edit' | 'participate' | 'view';
const LEVELS: readonly Level[] = ['edit', 'participate', 'view'];
const ADDER = 'a'.repeat(32);
const box = { x: 0, y: 0, width: 120, height: 80 };
const shape = (kind: string, extra: Record<string, unknown> = {}) =>
  ({ id: kind, type: 'shape', shape: kind, ...box, ...extra }) as unknown as Element;
const sticky = (extra: Record<string, unknown> = {}) =>
  ({ id: 's', type: 'sticky', ...box, label: 'Idea', ...extra }) as Element;
const text = { id: 'x', type: 'text', ...box, label: 'Note' } as Element;
const linkCard = { id: 'l', type: 'link-card', ...box } as Element;

const canFor = (level: Level): EditorCapabilities =>
  resolveEditorCapabilities({ level, adderKey: level === 'participate' ? ADDER : null });
// Nobody else holds the baton.
const gatesFor = (level: Level) => roleGates(canFor(level), false);
// A read-only session (a Participant or a Viewer) gets the participant selection modes; an Editor every tool.
const toolsFor = (level: Level): readonly string[] => {
  const all = buildCanvasToolOptions({ isMobile: false, includeZen: true }).map((o) => o.id);
  return level === 'edit' ? all : all.filter((id) => PARTICIPANT_CANVAS_TOOLS.includes(id));
};
// The palette strip: an Editor's full one, a Participant's own (it holds an adder key), none for a Viewer
// (CanvasChrome's `paletteShown`).
const paletteTileIdsFor = (level: Level): string[] => {
  if (level === 'view') return [];
  const categories =
    level === 'participate' ? participantPaletteCategories() : paletteCategoriesFor('workshop');
  return categories.flatMap((c) => (c.tiles ?? []).map((t) => t.id));
};

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

const NAVIGATE_TILES = tilesForCategory('collab-navigate').map((t) => t.id);
const NAVIGATE_ELEMENTS = [
  shape('portal', { label: 'Kitchen' }),
  shape('chair'),
  shape('room', { label: 'Lounge' }),
  shape('avatar-pad'),
  shape('focus-button'),
  linkCard,
];

describe('share roles in the editor (docs/specs/013-workspace/share-roles.md)', () => {
  // Walking writes nothing: the Avatar mode is in every role's selection modes, so a mode button and the Spaces
  // board's opening walk (useOpenWalking, which takes no role) take anyone into it.
  expectPerLevel(
    'Walk, hop, Behaviours, Reactions, Status',
    (level) => toolsFor(level).includes('avatar'),
    { edit: true, participate: true, view: true },
  );

  // useCanvasAvatar's `canSpeak` and the Avatar tour's Say Something step both read `can.takePart`.
  expectPerLevel(
    'Speak in a speech bubble',
    (level) => {
      const canSpeak = gatesFor(level).takePart;
      return [canSpeak, avatarTourSteps({ canSpeak, mobile: false }).some((s) => s.speaks)];
    },
    { edit: [true, true], participate: [true, true], view: [false, false] },
  );

  // Pushing, sitting and a drink are the character's own presence: in Avatar mode, which every role has, with no
  // gate of their own (EditorCanvasHost wires `onAvatarPush` and the seat and drink for every session).
  expectPerLevel(
    'Push another character, sit, take a drink',
    (level) => toolsFor(level).includes('avatar'),
    { edit: true, participate: true, view: true },
  );

  // A portal is walked through in Avatar mode; following is the viewport, whichever mode you are in.
  expectPerLevel(
    'Go through a portal, follow and be followed',
    (level) => ['avatar', 'pan'].every((tool) => toolsFor(level).includes(tool)),
    { edit: true, participate: true, view: true },
  );

  describe('Place, move, rename or delete Navigate elements', () => {
    it('Navigate has tiles to check', () => {
      expect(NAVIGATE_TILES.length).toBeGreaterThan(5);
    });
    expectPerLevel(
      'offered on the palette',
      (level) => NAVIGATE_TILES.filter((id) => paletteTileIdsFor(level).includes(id)).length,
      { edit: NAVIGATE_TILES.length, participate: 0, view: 0 },
    );
    expectPerLevel(
      'moved, resized, renamed, recoloured or removed',
      (level) => {
        const can = canFor(level);
        return NAVIGATE_ELEMENTS.some(
          (el) =>
            can.move(el) ||
            can.resize(el) ||
            can.recolour(el) ||
            can.remove(el) ||
            renames(can, el),
        );
      },
      { edit: true, participate: false, view: false },
    );
  });

  // The template start shows only where `roleGates(...).shape` (EditorStartPanels).
  expectPerLevel('Make a space or a board from a template', (level) => gatesFor(level).shape, {
    edit: true,
    participate: false,
    view: false,
  });

  // The Bring Focus face is pressable only where `roleGates(...).run` (EditorCanvasHost).
  expectPerLevel('Press Bring Focus', (level) => gatesFor(level).run, {
    edit: true,
    participate: false,
    view: false,
  });

  describe('Start, end, reveal or configure a session tool', () => {
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
  });

  describe('Take part in a session tool (vote, answer, react)', () => {
    expectPerLevel('with the baton free', (level) => gatesFor(level).takePart, {
      edit: true,
      participate: true,
      view: false,
    });
    it('the baton never stops anyone answering', () => {
      for (const level of LEVELS) {
        expect(roleGates(canFor(level), true).takePart).toBe(canFor(level).takePart);
      }
    });
  });

  // CollaboratorsDialog's Facilitator verbs, for your own row and another's.
  expectPerLevel('Hold the facilitator baton', (level) => mayHoldBaton(level), {
    edit: true,
    participate: false,
    view: false,
  });

  describe('Add, write and arrange stickies and text', () => {
    expectPerLevel(
      'the Sticky and Text tiles on the palette',
      (level) => ['tools:sticky', 'tools:text'].map((id) => paletteTileIdsFor(level).includes(id)),
      { edit: [true, true], participate: [true, true], view: [false, false] },
    );
    expectPerLevel(
      'add, write on, move and recolour a sticky; remove its own; write on text',
      (level) => {
        const can = canFor(level);
        return [
          can.addContent,
          can.writeText(sticky()),
          can.move(sticky()),
          can.recolour(sticky()),
          can.remove(sticky({ addedBy: ADDER })),
          can.writeText(text),
        ];
      },
      {
        edit: [true, true, true, true, true, true],
        participate: [true, true, true, true, true, true],
        view: [false, false, false, false, false, false],
      },
    );
  });

  // The comment popover's `canComment` and the Comment panel's actions read `can.takePart` (EditorAnchoredPopovers,
  // EditorCanvasHost).
  expectPerLevel('Comment, reply, resolve', (level) => gatesFor(level).takePart, {
    edit: true,
    participate: true,
    view: false,
  });

  // Every look-only tool is in every role's selection modes; export is a read, with no gate.
  expectPerLevel(
    'Pan, zoom, laser, spotlight, export',
    (level) => ['pan', 'laser', 'spotlight'].every((tool) => toolsFor(level).includes(tool)),
    { edit: true, participate: true, view: true },
  );

  describe('Change tabs, the theme, anything on the board else', () => {
    expectPerLevel('reshape the board', (level) => gatesFor(level).shape, {
      edit: true,
      participate: false,
      view: false,
    });
    // No tool that changes the board is in a read-only session's modes.
    expectPerLevel(
      'tools that change the board',
      (level) => CANVAS_TOOLS.filter((t) => t.mutates).some((t) => toolsFor(level).includes(t.id)),
      { edit: true, participate: false, view: false },
    );
    expectPerLevel(
      "move, resize or remove the board's own shapes",
      (level) => {
        const can = canFor(level);
        const col = shape('rectangle', { label: 'Column' });
        return [can.move(col), can.resize(col), can.remove(col)];
      },
      { edit: [true, true, true], participate: [false, false, false], view: [false, false, false] },
    );
  });
});

// Renaming is writing an element's words inline, where the element carries words (`elementSupportsText`) and the
// session may write on it. A link card carries none: its words are its link's, which the link picker edits (an
// Editor's, `onEditLink`).
function renames(can: EditorCapabilities, el: Element): boolean {
  return elementSupportsText(el) && can.writeText(el);
}
