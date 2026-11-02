// livehuddle's background patterns: every shared one (@liveworkspace/model-core/basics) plus the patterns only
// livehuddle offers. Isometric is one (docs/specs/008-canvas/canvas-and-palette.md): the other products retired it,
// so the shared list no longer holds it, and each of them reads a stored `isometric` as Crosshatch.
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
  (typeof SHARED_BACKGROUND_PATTERNS)[number] | (typeof OWN_BACKGROUND_PATTERNS)[number];

/** Whether a value read from stored or sent data is a background pattern livehuddle draws. */
export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  return (
    isSharedBackgroundPattern(value) ||
    (OWN_BACKGROUND_PATTERNS as readonly unknown[]).includes(value)
  );
}
