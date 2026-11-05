// livehuddle's background patterns: every shared one (@liveworkspace/model-core/basics) plus the patterns only
// livehuddle has. Its floors are those (docs/specs/011-theme/floors.md, ./floors.ts): the shared diagram patterns stay
// in the type only so a tab saved with one still reads, and is moved onto a floor on load. Isometric is livehuddle's
// too: the other products retired it, so the shared list no longer holds it.
import { FLOOR_PATTERNS } from './floors';
import {
  BACKGROUND_PATTERNS as SHARED_BACKGROUND_PATTERNS,
  isBackgroundPattern as isSharedBackgroundPattern,
} from '@liveworkspace/model-core/basics';

/** The patterns only livehuddle offers, beyond the shared ones. */
const OWN_BACKGROUND_PATTERNS = ['isometric'] as const;

// Spelt from the two lists rather than as the shared BackgroundPattern alias plus a member, so the api's OpenAPI
// generator (apps/api/scripts/gen-openapi-schemas.mjs) finds one BackgroundPattern enum, not two definitions of
// the same name. A tab's canvas background pattern: the shared ones, then livehuddle's own.
export type BackgroundPattern =
  | (typeof SHARED_BACKGROUND_PATTERNS)[number]
  | (typeof OWN_BACKGROUND_PATTERNS)[number]
  | (typeof FLOOR_PATTERNS)[number];

/** Whether a value read from stored or sent data is a background pattern livehuddle draws. */
export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  return (
    isSharedBackgroundPattern(value) ||
    (OWN_BACKGROUND_PATTERNS as readonly unknown[]).includes(value) ||
    (FLOOR_PATTERNS as readonly unknown[]).includes(value)
  );
}
