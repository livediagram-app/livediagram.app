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
import { tilesForCategory } from '@/components/palette/palette-tile-defs';
import { SPACE_CATEGORIES } from '@/components/palette/space-categories';
import { avatarTourSteps } from '@/components/tour/avatar-tour-steps';
import { stripPaletteFor } from '@/lib/avatar-palette';
import { avatarPressOutcome } from '@/lib/avatar-click-intent';

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
  // Every tool a role picks: the two sides of the Edit | Walk toggle, which Search and a board's buttons reach too
  // (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"). Hand, Eraser and Format are not modes.
  const all = CANVAS_TOOLS.map((t) => t.id);
  return level === 'edit' ? all : all.filter((id) => PARTICIPANT_CANVAS_TOOLS.includes(id));
};
// The building palette: an Editor's alone, none for a Participant or a Viewer (CanvasChrome reads
// `stripPaletteFor`, lib/avatar-palette; share-roles.md "A Participant walks", "Always walking").
const stripFor = (level: Level, walking: boolean) =>
  stripPaletteFor({ can: canFor(level), readOnly: level !== 'edit', walking });
const paletteTileIdsFor = (level: Level): string[] => {
  if (stripFor(level, false) !== 'build') return [];
  return paletteCategories().flatMap((c) => (c.tiles ?? []).map((t) => t.id));
};
// What the Edit | Walk toggle and the mode buttons can do for each level: CanvasChrome builds the toggle where
// `!can.alwaysWalks`, and EditorCanvasHost gives the mode buttons a press where `!can.alwaysWalks`; useCanvasTool holds
// a Participant and a Viewer in Avatar mode (`holdWalking(can.alwaysWalks)`).

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

  // Only an Editor enters and leaves Avatar mode, through the Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md
  // "The Edit | Walk toggle"). A Participant and a Viewer are always walking, with no toggle and no way out
  // (share-roles.md "Always walking", owner 2026-11-06). CanvasChrome builds the toggle where `!can.alwaysWalks`;
  // useCanvasTool's hold refuses every other tool where `can.alwaysWalks`.
  expectPerLevel(
    'Enter and leave Avatar mode on any board',
    (level) => (canFor(level).alwaysWalks ? 'always walking' : 'edit walk toggle'),
    { edit: 'edit walk toggle', participate: 'always walking', view: 'always walking' },
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
    (level) => toolsFor(level).includes('avatar'),
    { edit: true, participate: true, view: true },
  );

  // A walking click on a control piece (share-roles.md "Always walking", bring-focus.md "Rules"): its face has a press
  // where the gate opens (EditorCanvasHost gives Bring Focus `onPressFocusButton` on `gates.run`, a mode button
  // `onPressModeButton` where `!can.alwaysWalks`; TimerView draws its controls on `can.takePart`), and without one the
  // click does nothing: never the reader, never a walk (avatarPressOutcome, owner 2026-11-06).
  describe('Press Bring Focus', () => {
    expectPerLevel(
      'a walking click on it, the baton free',
      (level) => avatarPressOutcome('focus-button', gatesFor(level).run),
      { edit: 'press', participate: 'nothing', view: 'nothing' },
    );
    it('an Editor while somebody else holds the baton: nothing, no reader', () => {
      expect(avatarPressOutcome('focus-button', roleGates(canFor('edit'), true).run)).toBe(
        'nothing',
      );
    });
  });
  expectPerLevel(
    'A walking click on a Selection Mode button',
    (level) => avatarPressOutcome('mode-button', !canFor(level).alwaysWalks),
    { edit: 'press', participate: 'nothing', view: 'nothing' },
  );
  expectPerLevel(
    'A walking click on a Timer or Stopwatch',
    (level) =>
      [
        avatarPressOutcome('timer', canFor(level).takePart),
        avatarPressOutcome('stopwatch', canFor(level).takePart),
      ] as const,
    { edit: ['press', 'press'], participate: ['press', 'press'], view: ['nothing', 'nothing'] },
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

  // The pieces a Participant keeps (share-roles.md "A Participant walks"): a Door's swing, one saved locked too.
  // Pinning its own notes on a Notice Board goes through the board's popover (NoticeBoardPopover, its adder key).
  expectPerLevel(
    'Swing a door, one saved locked too',
    (level) => {
      const can = canFor(level);
      return [can.swingDoor(shape('door')), can.swingDoor(shape('door', { locked: true }))];
    },
    { edit: [true, true], participate: [true, true], view: [false, false] },
  );

  // The comment popover's `canComment` and the Comment panel's actions read `can.takePart` (EditorAnchoredPopovers,
  // EditorCanvasHost).
  expectPerLevel('Comment, reply, resolve', (level) => gatesFor(level).takePart, {
    edit: true,
    participate: true,
    view: false,
  });

  // Panning is no mode (Space-drag, the trackpad and the middle button pan in every tool), so no role's tools can
  // withhold it; every tool a role picks is look-only; export is a read, with no gate.
  expectPerLevel(
    'Pan, zoom, export',
    (level) => toolsFor(level).every((tool) => PARTICIPANT_CANVAS_TOOLS.includes(tool)),
    { edit: true, participate: true, view: true },
  );

  // The avatar palette (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): every role's strip while it
  // walks, a Participant's and a Viewer's always. It has no selection-mode picker for anyone. Its call group, at its
  // left, is where every role's call controls are: with a Participant and a Viewer always walking, no role is left
  // without a strip to hold them.
  describe('The avatar palette while walking, with the call controls', () => {
    expectPerLevel('the strip while walking', (level) => stripFor(level, true), {
      edit: 'avatar',
      participate: 'avatar',
      view: 'avatar',
    });
    expectPerLevel(
      'the strip while not walking',
      (level) => stripFor(level, false),
      // A Participant and a Viewer always walk, so they never see anything else.
      { edit: 'build', participate: 'avatar', view: 'avatar' },
    );
    // Say is offered where `onSendAvatarMessage` is: useCanvasAvatar's `canSpeak`, `can.takePart`.
    expectPerLevel('its Say button', (level) => gatesFor(level).takePart, {
      edit: true,
      participate: true,
      view: false,
    });
  });

  describe('Change tabs, the theme, anything on the board else', () => {
    expectPerLevel('reshape the board', (level) => gatesFor(level).shape, {
      edit: true,
      participate: false,
      view: false,
    });
    // No canvas tool changes the board: the Format Painter, the one that did, starts from the selection toolbar, an
    // Editor's alone (CanvasSelectionToolbars passes `onFormatPainter` where `!readOnly`).
    expectPerLevel(
      'tools that change the board',
      (level) => [
        toolsFor(level).some((tool) => ['eraser', 'format'].includes(tool)),
        stripFor(level, false) === 'build',
      ],
      { edit: [false, true], participate: [false, false], view: [false, false] },
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
