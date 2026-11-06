// docs/specs/013-workspace/share-roles.md: livehuddle makes no new Viewer link, so the Viewer cases below are a legacy
// Viewer link's ("Legacy Viewer links"), which keeps every gate it had.
import { describe, expect, it } from 'vitest';
import { elementSupportsText, type Element } from '@livehuddle/document';
import { CANVAS_TOOLS } from '@/lib/editor-commands';
import {
  mayHoldBaton,
  resolveEditorCapabilities,
  roleGates,
  type EditorCapabilities,
} from '@/lib/editor-capabilities';
import { PARTICIPANT_CANVAS_TOOLS, paletteCategories } from '@/components/palette/palette-layouts';
import { buildCanvasToolOptions } from '@/components/palette/canvas-tool-options';
import { tilesForCategory } from '@/components/palette/palette-tile-defs';
import { SPACE_CATEGORIES } from '@/components/palette/space-categories';
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
  const all = buildCanvasToolOptions({}).map((o) => o.id);
  return level === 'edit' ? all : all.filter((id) => PARTICIPANT_CANVAS_TOOLS.includes(id));
};
// The palette strip: an Editor's alone, none for a Participant or a Viewer (CanvasChrome's `paletteShown`,
// `!readOnly`; share-roles.md "A Participant walks").
const paletteTileIdsFor = (level: Level): string[] => {
  if (level !== 'edit') return [];
  return paletteCategories().flatMap((c) => (c.tiles ?? []).map((t) => t.id));
};
// What the Walk button and the mode buttons can do for each level: EditorCanvasHost draws the Walk button where
// `!can.alwaysWalks`, and gives the mode buttons a press where `!can.alwaysWalks`; useCanvasTool holds a Participant
// in Avatar mode (`holdWalking(can.alwaysWalks)`).

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

// The Space categories' tiles (docs/specs/010-palette/palette-top-level-categories.md "The Space categories").
const NAVIGATE_TILES = SPACE_CATEGORIES.flatMap((c) => tilesForCategory(c.id)).map((t) => t.id);
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

  // An Editor and a Viewer enter and leave Avatar mode on any board through the cluster's Walk button
  // (docs/specs/008-canvas/avatar-mode.md "The Walk button"), an Editor on its strip too. A Participant is always
  // walking, with no way out (share-roles.md "A Participant walks"). Work Tracker #361.
  expectPerLevel(
    'Enter and leave Avatar mode on any board',
    (level) => {
      const can = canFor(level);
      if (can.alwaysWalks) return 'always walking';
      const picker = level === 'edit' && toolsFor(level).includes('avatar');
      return picker ? 'walk button and picker' : 'walk button';
    },
    { edit: 'walk button and picker', participate: 'always walking', view: 'walk button' },
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

  // Video and screen share bubbles (docs/specs/012-collaboration/video-and-screen-bubbles.md "Share roles"):
  // useCanvasCall's `canSpeak` (the camera) reads `can.takePart`; EditorCanvasHost's `canShareScreen` reads
  // `gates.shape`. Seeing and maximising a bubble has no gate: everyone in a call sees the people near them.
  expectPerLevel(
    'Turn on a camera, share a screen',
    (level) => [gatesFor(level).takePart, gatesFor(level).shape],
    { edit: [true, true], participate: [true, false], view: [false, false] },
  );

  // A local preview (video-and-screen-bubbles.md "Local preview") sends nothing: anyone who may take part has one
  // (useProximityCall's `canPreviewCamera`/`canPreviewScreen` read `canSpeak`, `can.takePart`), and sending still
  // follows the row above, so a Participant's screen stays a preview.
  expectPerLevel('Preview your own camera or screen', (level) => gatesFor(level).takePart, {
    edit: true,
    participate: true,
    view: false,
  });

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

  describe('Take part in a session tool (answer, react)', () => {
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

  // A Participant adds, writes, arranges and deletes nothing, its own earlier stickies included (share-roles.md
  // "A Participant walks"); the room refuses it too (apps/api/src/share-roles.test.ts).
  describe('Add, write, arrange or delete stickies and text', () => {
    expectPerLevel(
      'the Sticky and Text tiles on the palette',
      (level) => ['tools:sticky', 'tools:text'].map((id) => paletteTileIdsFor(level).includes(id)),
      { edit: [true, true], participate: [false, false], view: [false, false] },
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
        participate: [false, false, false, false, false, false],
        view: [false, false, false, false, false, false],
      },
    );
  });

  // The pieces a Participant keeps (share-roles.md "A Participant walks"): a Door's swing where it is unlocked.
  // Pinning its own notes on a Notice Board goes through the board's popover (NoticeBoardPopover, its adder key).
  expectPerLevel(
    'Swing an unlocked door, not a locked one',
    (level) => {
      const can = canFor(level);
      return [can.swingDoor(shape('door')), can.swingDoor(shape('door', { locked: true }))];
    },
    { edit: [true, true], participate: [true, false], view: [false, false] },
  );

  // The comment popover's `canComment` and the Comment panel's actions read `can.takePart` (EditorAnchoredPopovers,
  // EditorCanvasHost).
  expectPerLevel('Comment, reply, resolve', (level) => gatesFor(level).takePart, {
    edit: true,
    participate: true,
    view: false,
  });

  // Every look-only tool is in every role's selection modes; export is a read, with no gate.
  expectPerLevel(
    'Pan, zoom, export',
    (level) => ['select', 'pan'].every((tool) => toolsFor(level).includes(tool)),
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
