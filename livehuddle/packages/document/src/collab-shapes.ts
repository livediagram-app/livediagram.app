// The chair's seat facings (docs/specs/009-elements/chair.md) and which kinds draw their own face rather than an
// ordinary label. The Collaborate panels that once lived here (the estimate card, the temperature check, the idea box,
// the Q&A board, the agenda, the decision record, the roll call, the quiz and the done check) are gone from
// livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a stored one is a retired
// element, drawn as a placeholder.
//
// A LEAF module (types only, plus the leaf ./shape-kinds) for the same reason data-shapes.ts is one: factories.ts
// reads these at module-init time, and importing them from './index' would put a runtime read inside the
// index <-> factories cycle. Everything here is re-exported from './index'.

import type { ShapeKind } from './index';
import { isSelfDrawingShape } from './data-shapes';
import { SHAPE_KINDS } from './shape-kinds';
import type { AvatarFacing } from '@liveworkspace/avatar/walk';
import {
  DEFAULT_SEATING_FACING,
  SEAT_SITTER_FACING,
  type SeatFacing,
} from '@liveworkspace/avatar/seats';

// --- Chair (docs/specs/009-elements/chair.md) ------------------------------------------------------

// Which way the seat points. 'n' = the chair's back is at the top, so the
// sitter faces down the canvas toward the reader. The vocabulary is the seat
// geometry's (@liveworkspace/avatar/seats), which every product seats with.
export type ChairFacing = SeatFacing;
export const CHAIR_FACINGS: readonly ChairFacing[] = ['n', 'e', 's', 'w'];
export const DEFAULT_CHAIR_FACING: ChairFacing = DEFAULT_SEATING_FACING.chair;

export const CHAIR_FACING_LABELS: Record<ChairFacing, string> = {
  n: 'Facing down',
  e: 'Facing left',
  s: 'Facing up',
  w: 'Facing right',
};

export function isChairFacing(value: unknown): value is ChairFacing {
  return (CHAIR_FACINGS as readonly string[]).includes(value as string);
}

// Which way somebody sitting in the chair looks, in the avatar's own facing
// vocabulary (the same four words CHAIR_FACING_LABELS prints). The seat points
// AWAY from the back, so a chair with its back at the top ('n') faces its
// sitter down the canvas.
export type ChairSitterFacing = AvatarFacing;

export const CHAIR_SITTER_FACING: Readonly<Record<ChairFacing, ChairSitterFacing>> =
  SEAT_SITTER_FACING;

// --- Faces -----------------------------------------------------------------

// A kind livehuddle does not have: a retired element (./retired-kinds), whose placeholder draws its own name, note
// and stored label in place of an ordinary label.
const isRetiredKind = (kind: string): boolean => !SHAPE_KINDS.has(kind);

// Kinds whose resting face draws its own layout and shows the label as a
// plain title (the seating, the buttons, the portal, and a
// retired element's placeholder): the editor's ElementFaceRouter hands them
// the label string, never the aligned label node, so text alignment has
// nothing to move on them. Kept here, beside the kind predicates, so the
// router's list and the text-align gate below can't drift apart.
export function hasOwnFace(kind: ShapeKind): boolean {
  return (
    kind === 'chair' ||
    kind === 'desk' ||
    kind === 'sofa' ||
    kind === 'mode-button' ||
    kind === 'focus-button' ||
    kind === 'portal' ||
    isRetiredKind(kind)
  );
}

// Whether double-click, Space or typing opens the inline label editor on this
// kind. Not on a self-drawing kind (it has no label), and not on a retired
// element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements": it takes no typed label).
export function opensInlineLabelEditor(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !isRetiredKind(kind);
}

// Whether text alignment does anything on this kind: not a self-drawing kind
// (no label at all) and not one with its own face (the label is a fixed
// title). An icon keeps it: its alignment places the caption above, below or
// beside the glyph, and the glyph moves to make room
// (docs/specs/010-palette/technology-icons.md "caption's alignment"); left out, an
// icon's caption could never be moved. The one gate for both the context menu
// and the quick style panel. Web components (banner, callout, header) and
// pages keep it: they render the aligned label.
export function supportsTextAlign(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !hasOwnFace(kind);
}

// Whether shape markers (docs/specs/009-elements/shape-markers.md) do anything on this kind: a marker
// decorates the label, so not on a self-drawing kind (no label) and not on one
// with its own face (the label is a fixed title the face draws, and a marker
// never shows on it). The one gate for the single-element and multi-selection
// menus.
export function supportsMarkers(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !hasOwnFace(kind);
}
