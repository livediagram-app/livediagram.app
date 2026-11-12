// The shape element's field checks (validate.ts): its kind, the bounded data arrays of rails, and
// the closed sets and bounded rows of the content-carrying kinds. Each check names its field and
// rule, so a refusal says which value to fix. The fields only retired elements carried (a session's
// poll, a board's notes, the responses, a chart's rows, a code block's code, ...) have no check:
// nothing in livehuddle reads them, and a stored one stays exactly as it is
// (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements", "The element engine").
// The helpers and the checks two or more products hold the same way are
// @liveworkspace/element-model/shape-field-checks; this list keeps this product's order and its own checks.

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
import {
  type ElementValidationIssue,
  type FieldCheck,
  isNonEmptyStr,
  oneOfRule,
} from '@liveworkspace/model-core/validate-primitives';
import { flag, shapeIssue } from '@liveworkspace/element-model/shape-field-checks';

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`portalTarget`, `mindParentId`) are legal: the element renders unpaired or as a root.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'portalTarget', valid: isNonEmptyStr, rule: 'an element id' },
  { field: 'mode', valid: isSelectionMode, rule: oneOfRule(SELECTION_MODES) },
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
  flag('receptionistLeft'),
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
  return shapeIssue(el, SHAPE_FIELD_CHECKS);
}
