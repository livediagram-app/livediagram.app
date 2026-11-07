// The shape element's field checks (validate.ts): its kind, the bounded data arrays of rails, and
// the closed sets and bounded rows of the content-carrying kinds. Each check names its field and
// rule, so a refusal says which value to fix. The fields only retired elements carried (a session's
// poll, a board's notes, the responses, a chart's rows, a code block's code, ...) have no check:
// nothing in livehuddle reads them, and a stored one stays exactly as it is
// (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements", "The element engine").

import { isRoomDoor, isStageSpeakers } from './office';
import { isPieceVariant, PIECE_VARIANT_MAX } from './piece-variants';
import {
  CLOCK_LABEL_MAX,
  CLOCK_ZONES_MAX,
  isClockZones,
  isJukeboxSource,
  isNoticeNotes,
  NOTE_TEXT_MAX,
  NOTES_MAX,
} from './office-social';
import { isScreenUrl, SCREEN_URL_MAX } from './meeting-pieces';
import { isPieceTimer, TIMER_MINUTES_MAX } from './timer-pieces';
import { ARCADE_NAME_MAX, ARCADE_SCORES_MAX, isArcadeScores } from './arcade-scores';
import { isRoomOutline, ROOM_OUTLINE_MAX, ROOM_OUTLINE_MIN } from './room-outline-field';
import { SELECTION_MODES, isSelectionMode } from './selection-mode';
import { isChairFacing } from './collab-shapes';
import { PAGE_HEADING_MAX } from './data-shapes';
import { CARD_TAG_MAX, CARD_TAGS_MAX, isCardMedia } from './card';
import { isChipLook } from './chip';
import { isAttachPoint } from './attachment';
import { isPointerTip } from './pointer-note';
import { isBoundaryStyle } from './boundary';
import {
  type ElementValidationIssue,
  type FieldCheck,
  arrayRule,
  boundedArray,
  firstFieldIssue,
  isBool,
  isNonEmptyStr,
  issue,
  oneOfRule,
  stringRule,
} from '@liveworkspace/model-core/validate-primitives';
import { isRecord } from '@liveworkspace/model-core/is-record';

// railLabels.
const MAX_DATA_ARRAY = 5_000;

const isStrUpTo = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;
// A single-line heading (a card's, a callout's and a boundary's, docs/specs/009-elements/card.md).
const isHeadingStr = isStrUpTo(PAGE_HEADING_MAX);
const isOptionalStrUpTo = (v: unknown, max: number) => v === undefined || isStrUpTo(max)(v);
const rowsOf =
  (max: number, row: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    boundedArray(v, max) && v.every(row);
const dataArray = (field: string): FieldCheck => ({
  field,
  valid: (v) => boundedArray(v, MAX_DATA_ARRAY),
  rule: arrayRule(MAX_DATA_ARRAY),
});
// The chip looks and attach points a refusal lists, written out: chip.ts sits in an import cycle with this module, so
// its lists may be uninitialised while this one loads (the api worker failed to start). A test keeps the copies equal.
export const CHIP_LOOKS_RULE = ['solid', 'ink', 'outline', 'tinted', 'quiet'] as const;
export const ATTACH_POINTS_RULE = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const;

const flag = (field: string): FieldCheck => ({ field, valid: isBool, rule: 'a boolean' });

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`portalTarget`, `mindParentId`) are legal: the element renders unpaired or as a root.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'titleOrientation', valid: (v) => v === 'upright', rule: oneOfRule(['upright']) },
  dataArray('railLabels'),
  { field: 'portalTarget', valid: isNonEmptyStr, rule: 'an element id' },
  { field: 'mode', valid: isSelectionMode, rule: oneOfRule(SELECTION_MODES) },
  { field: 'pageTitle', valid: isHeadingStr, rule: stringRule(PAGE_HEADING_MAX) },
  { field: 'pageSubtitle', valid: isHeadingStr, rule: stringRule(PAGE_HEADING_MAX) },
  // Card slots (docs/specs/009-elements/card.md).
  { field: 'cardMedia', valid: isCardMedia, rule: oneOfRule(['badge', 'tile', 'initial']) },
  flag('cardHeader'),
  // Badge and Step number (docs/specs/009-elements/badge.md).
  { field: 'chipLook', valid: isChipLook, rule: oneOfRule(CHIP_LOOKS_RULE) },
  { field: 'attachedTo', valid: isNonEmptyStr, rule: 'an element id' },
  { field: 'attachAt', valid: isAttachPoint, rule: oneOfRule(ATTACH_POINTS_RULE) },
  flag('stepSequence'),
  {
    field: 'pointerTip',
    // Read at call time: pointer-note.ts sits on an import cycle with attachment.ts, so it may not be loaded yet
    // when this table is built.
    valid: (v: unknown) => isPointerTip(v),
    rule: 'an { x, y } of finite numbers within ±4000',
  },
  // A stack's arrangement (docs/specs/009-elements/stack.md).
  {
    field: 'stackDirection',
    valid: (v: unknown) => v === 'row' || v === 'column' || v === 'grid',
    rule: oneOfRule(['row', 'column', 'grid']),
  },
  {
    field: 'stackAlign',
    valid: (v: unknown) => v === 'start' || v === 'center' || v === 'end',
    rule: oneOfRule(['start', 'center', 'end']),
  },
  {
    field: 'stackGap',
    valid: (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 64,
    rule: 'a whole number 0 to 64',
  },
  {
    field: 'stackPadding',
    valid: (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 64,
    rule: 'a whole number 0 to 64',
  },
  {
    field: 'stackColumns',
    valid: (v: unknown) => Number.isInteger(v) && (v as number) >= 2 && (v as number) <= 6,
    rule: 'a whole number 2 to 6',
  },
  // A diagram key (docs/specs/009-elements/diagram-key.md): derived rows, and the author's meanings.
  {
    field: 'keyRows',
    valid: rowsOf(
      12,
      (r) =>
        isRecord(r) &&
        isStrUpTo(48)(r.id) &&
        (r.kind === 'line' || r.kind === 'tag') &&
        isOptionalStrUpTo(r.style, 40) &&
        isOptionalStrUpTo(r.tag, 40) &&
        isOptionalStrUpTo(r.color, 40),
    ),
    rule: 'an array of at most 12 { id, kind: line | tag, style?, tag?, color? } rows',
  },
  {
    field: 'keyMeanings',
    valid: (v: unknown) =>
      isRecord(v) &&
      Object.keys(v).length <= 24 &&
      Object.entries(v).every(([k, t]) => k.length <= 48 && isStrUpTo(60)(t)),
    rule: 'at most 24 row meanings of at most 60 characters',
  },
  // Boundary (docs/specs/009-elements/boundary.md).
  { field: 'boundaryStyle', valid: isBoundaryStyle, rule: oneOfRule(['tab', 'inset', 'c4']) },
  // A Timeline (docs/specs/009-elements/timeline.md): the rows are content; the animation is
  // cosmetic and lenient, like every element animation.
  {
    field: 'conceptRows',
    valid: rowsOf(8, (r) => isRecord(r) && isStrUpTo(60)(r.label) && isOptionalStrUpTo(r.note, 40)),
    rule: 'an array of at most 8 { label, note? } rows (60 and 40 characters)',
  },
  {
    field: 'tags',
    valid: rowsOf(CARD_TAGS_MAX, isStrUpTo(CARD_TAG_MAX)),
    rule: `an array of at most ${CARD_TAGS_MAX} strings of at most ${CARD_TAG_MAX} characters`,
  },
  { field: 'chairFacing', valid: isChairFacing, rule: 'a chair facing' },
  { field: 'roomDoor', valid: isRoomDoor, rule: 'a room doorway (n, e, s, w or none)' },
  {
    field: 'roomOutline',
    valid: isRoomOutline,
    rule: `a room outline (${ROOM_OUTLINE_MIN} to ${ROOM_OUTLINE_MAX} corners, each x and y from 0 to 1)`,
  },
  {
    field: 'stageSpeakers',
    valid: isStageSpeakers,
    rule: 'who may speak from a stage (edit or take-part)',
  },
  flag('stageCameras'),
  flag('doorClosed'),
  {
    field: 'variant',
    valid: isPieceVariant,
    rule: `a piece's type (1 to ${PIECE_VARIANT_MAX} lowercase letters and hyphens)`,
  },
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  {
    field: 'noticeNotes',
    valid: isNoticeNotes,
    rule: `at most ${NOTES_MAX} notes { id, title?, text (1 to ${NOTE_TEXT_MAX} characters), author, by, at, color? }`,
  },
  {
    field: 'clockZones',
    valid: isClockZones,
    rule: `at most ${CLOCK_ZONES_MAX} { zone (an IANA time zone), label (${CLOCK_LABEL_MAX} characters) } rows`,
  },
  { field: 'jukeboxSource', valid: isJukeboxSource, rule: 'an https audio address' },
  // A Timer's or Stopwatch's clock (docs/specs/009-elements/timer-and-stopwatch.md "The state").
  {
    field: 'pieceTimer',
    valid: (v: unknown) => isPieceTimer(v, 'timer') || isPieceTimer(v, 'stopwatch'),
    rule: `a clock { running, startedAt, accumulatedMs, durationMs (0, or 1 to ${TIMER_MINUTES_MAX} minutes) }`,
  },
  // An Arcade Machine's High Scores (docs/specs/009-elements/social-pieces.md "High Scores").
  {
    field: 'arcadeScores',
    valid: isArcadeScores,
    rule: `at most ${ARCADE_SCORES_MAX} scores { id, name (${ARCADE_NAME_MAX} characters), score (1 to the run's ceiling), ms, by, at }`,
  },
  // A Screen's Video Link (docs/specs/009-elements/screen-and-room-sign.md "Screen").
  {
    field: 'screenUrl',
    valid: isScreenUrl,
    rule: `an http(s) address of at most ${SCREEN_URL_MAX} characters`,
  },
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (!isNonEmptyStr(el.shape)) return issue('shape', 'a shape kind');
  return firstFieldIssue(el, SHAPE_FIELD_CHECKS);
}
