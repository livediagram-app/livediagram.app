// Icons of the editor's context menus (element, multi-selection, canvas, layer row). One family
// (docs/specs/004-interface-design/iconography.md, "Size steps"): row and section icons render at
// MENU_ICON_PX, the pinned quick-action buttons at QUICK_ACTION_ICON_PX, all on the 24-unit grid so
// their ink reads the same size. Lucide where it has the meaning; in-house glyphs follow the same grid.
// Option tiles (animation kinds, layout styles, rotation) are previews and keep their own drawing.

import {
  ActionIcon,
  CommentIcon,
  CopyIcon as SharedCopyIcon,
  DuplicateIcon,
  Glyph,
  LinkIcon,
  lucideGlyph,
  NoteIcon,
  TrashIcon,
} from '@livediagram/ui';
import {
  lucideArrowRight,
  lucideBaseline,
  lucideBringToFront,
  lucideChartNoAxesColumnIncreasing,
  lucideCircleCheck,
  lucideClipboardPaste,
  lucideImage,
  lucideLayers,
  lucidePalette,
  lucidePaintbrush,
  lucideProportions,
  lucideRadio,
  lucideRotateCwSquare,
  lucideScaling,
  lucideScissors,
  lucideSendToBack,
  lucideShapes,
  lucideSquare,
  lucideStar,
  lucideStarOff,
  lucideTable,
  lucideTimer,
  lucideType,
  lucideWandSparkles,
  lucideWrench,
} from '@livediagram/icons/lucide';

/** Size step of every menu row and section icon. */
export const MENU_ICON_PX = 14;
/** Size step of the icon-only quick-action buttons pinned to the top of a menu. */
export const QUICK_ACTION_ICON_PX = 16;

export const LayerUpIcon = lucideGlyph(lucideBringToFront, MENU_ICON_PX);
export const LayerDownIcon = lucideGlyph(lucideSendToBack, MENU_ICON_PX);

// The note / action / comment / link glyphs are the shared element-affordance drawings
// (@livediagram/ui), the same ones the on-element badge pill shows, at the menu step.
export function NoteMenuIcon() {
  return <NoteIcon size={MENU_ICON_PX} />;
}

// Clipboard-with-tick glyph for the Assign Action tile (docs/specs/012-collaboration/assigned-actions.md).
export function ActionMenuIcon() {
  return <ActionIcon size={MENU_ICON_PX} />;
}

export function CommentMenuIcon() {
  return <CommentIcon size={MENU_ICON_PX} />;
}

export function LinkMenuIcon() {
  return <LinkIcon size={MENU_ICON_PX} />;
}

// The "Shape" section: the element's outline.
export const SquareMenuIcon = lucideGlyph(lucideShapes, MENU_ICON_PX);
export const PaletteMenuIcon = lucideGlyph(lucidePalette, MENU_ICON_PX);
// The Timer session-tool category glyph.
export const TimerMenuIcon = lucideGlyph(lucideTimer, MENU_ICON_PX);
// The Vote session-tool category glyph (a cast dot-vote).
export const VoteMenuIcon = lucideGlyph(lucideCircleCheck, MENU_ICON_PX);
// The Poll session-tool category glyph (docs/specs/012-collaboration/live-poll.md, a live tally),
// distinct from Vote's check: a poll counts answers from people.
export const PollMenuIcon = lucideGlyph(lucideChartNoAxesColumnIncreasing, MENU_ICON_PX);

// A small arrow pointing in `dir` (one up-arrow path, rotated). Used by the
// inline-icon placement picker's cross of direction cells.
export function DirArrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <Glyph size={11} units={12} style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M6 2.5V9.5M3 5.5 6 2.5 9 5.5" />
    </Glyph>
  );
}

// The Rotation category glyph: a turn arrow round a square.
export const RotationMenuIcon = lucideGlyph(lucideRotateCwSquare, MENU_ICON_PX);

// Orientation preview for a Rotation option: a square with a marker on its top edge, rotated by
// `deg` about its centre, so each option shows which way the element will face.
export function RotationGlyph({ deg }: { deg: number }) {
  return (
    <Glyph size={15} units={16}>
      <g transform={`rotate(${deg} 8 8)`}>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
        {/* Filled tab centred on the top edge marks "up". */}
        <circle cx="8" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
      </g>
    </Glyph>
  );
}

// Diagonal stroke - the "Line" section glyph.
export function LineGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d="M5 19 19 5" />
    </Glyph>
  );
}

// The "Pointer" section.
export const PointerGlyph = lucideGlyph(lucideArrowRight, MENU_ICON_PX);
export const TableGlyph = lucideGlyph(lucideTable, MENU_ICON_PX);
export const ImageGlyph = lucideGlyph(lucideImage, MENU_ICON_PX);
// The "Border" section: the outline alone.
export const BorderGlyph = lucideGlyph(lucideSquare, MENU_ICON_PX);

// The "Shadow" category glyph (docs/specs/008-canvas/element-shadows.md): a box with an offset
// shade behind.
export function ShadowMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <rect
        x="6"
        y="6"
        width="16"
        height="16"
        rx="2"
        fill="currentColor"
        stroke="none"
        opacity="0.35"
      />
      <rect x="2" y="2" width="16" height="16" rx="2" />
    </Glyph>
  );
}

// The "Layer" section glyph.
export const LayersGlyph = lucideGlyph(lucideLayers, MENU_ICON_PX);
// Animation section glyph (docs/specs/008-canvas/canvas-and-palette.md): a dot with motion arcs.
export const AnimationMenuGlyph = lucideGlyph(lucideRadio, MENU_ICON_PX);
// The "Tools" / "Session" / "Scale" rows: a wrench (sliders are Settings).
export const ToolsMenuGlyph = lucideGlyph(lucideWrench, MENU_ICON_PX);
// The "Style" flyout row (docs/specs/008-canvas/canvas-and-palette.md): a paintbrush, distinct from
// the Colours child's palette and the Presets child's wand.
export const StyleMenuGlyph = lucideGlyph(lucidePaintbrush, MENU_ICON_PX);
// The "Presets" category (docs/specs/010-palette/style-presets.md): one-click styled looks.
export const PresetsMenuGlyph = lucideGlyph(lucideWandSparkles, MENU_ICON_PX);

// Progress section icon (docs/specs/009-elements/progress.md): a half-filled pill.
export function ProgressMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <rect x="2" y="8" width="20" height="8" rx="4" />
      <path d="M6 8h5v8H6a4 4 0 0 1 0-8Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

// The Size category glyph (docs/specs/008-canvas/element-size.md): "how big", against the
// aspect-lock mark below which reads as "keep the proportion".
export const SizeMenuIcon = lucideGlyph(lucideScaling, MENU_ICON_PX);
// The "lock aspect ratio" row glyph.
export const AspectLockMenuIcon = lucideGlyph(lucideProportions, MENU_ICON_PX);
// The "Text" category glyph.
export const TextGlyph = lucideGlyph(lucideType, MENU_ICON_PX);
// The "Icon" category glyph, and its struck-through sibling "remove the inline icon".
export const IconCategoryGlyph = lucideGlyph(lucideStar, MENU_ICON_PX);
export const RemoveIconGlyph = lucideGlyph(lucideStarOff, MENU_ICON_PX);

// Quick-action verbs (cut / copy / duplicate / remove / paste): the shared glyphs where one exists.
export const CutIcon = lucideGlyph(lucideScissors, QUICK_ACTION_ICON_PX);

export function CopyIcon() {
  return <SharedCopyIcon size={QUICK_ACTION_ICON_PX} />;
}

export function DuplicateMenuIcon() {
  return <DuplicateIcon size={QUICK_ACTION_ICON_PX} />;
}

export function RemoveIcon() {
  return <TrashIcon size={QUICK_ACTION_ICON_PX} />;
}

// Paste: a clipboard with a sheet lifting off it, so it never reads as Copy's two sheets.
export const PasteMenuIcon = lucideGlyph(lucideClipboardPaste, QUICK_ACTION_ICON_PX);

// Colour-category marks (docs/specs/008-canvas/canvas-and-palette.md Colours). "Text",
// "Background", "Border" and "Heading" are four labels of similar length; the glyph separates them
// at a glance. Each draws the SURFACE it paints, not a generic paint pot.

/** Text colour: a letterform over a baseline. */
export const TextColourIcon = lucideGlyph(lucideBaseline, MENU_ICON_PX);

const BOX = 'M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z';

/** Background: the box, its whole face flooded. */
export function FillColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d={BOX} fill="currentColor" />
    </Glyph>
  );
}

/** Border: the same box with only its edge drawn. */
export function BorderColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d={BOX} />
    </Glyph>
  );
}

/** Heading: the box again, with just its top band filled. */
export function HeadingColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d={BOX} />
      <path d="M5 4h14a3 3 0 0 1 3 3v2H2V7a3 3 0 0 1 3-3Z" fill="currentColor" />
    </Glyph>
  );
}

/** Pointer: an arrowhead, for the colour of the heads rather than the line. */
export function PointerColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d="M2 12h11" />
      <path d="M13 6.5 22 12l-9 5.5Z" fill="currentColor" />
    </Glyph>
  );
}
