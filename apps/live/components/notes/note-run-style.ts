// Typography for a rich-text note (spec/92). Shared by the read-only
// renderer (NoteRichText) and the contentEditable editor so a note looks
// identical whether you're reading it or writing it — the editor paints the
// same CSS onto its spans that the renderer puts on its React spans.
//
// A note has no whole-element base to inherit (unlike a label, which sits on
// a shape with its own text fields), so every unset delta falls back to the
// fixed body style below.

import type { RunHeading, RunSize, TextRun } from '@livediagram/diagram';
import { isSafeFollowUrl } from '@/lib/url-safety';

// Body size, in px. Small enough to fit a real paragraph in the popover,
// large enough to read comfortably.
export const NOTE_BASE_PX = 13;

// A run's explicit size override, on the same scale as the body.
export const NOTE_RUN_PX: Record<RunSize, number> = { sm: 11, md: 13, lg: 16 };

// Heading levels are line-level emphasis, not a separate block model: each
// is a size + weight step over the body.
const NOTE_HEADING: Record<RunHeading, { px: number; weight: number }> = {
  1: { px: 17, weight: 700 },
  2: { px: 14.5, weight: 600 },
  3: { px: 13.5, weight: 600 },
};

/**
 * The address a linked run should actually navigate to, or null when the run
 * carries no link or one whose scheme we refuse to follow. Re-checked here
 * (not only at entry) so a note that arrived from the API, an import, or an
 * older build still can't smuggle a `javascript:` URL into an anchor.
 */
export function noteRunHref(run: TextRun): string | null {
  if (!run.link) return null;
  return isSafeFollowUrl(run.link) ? run.link : null;
}

/** Resolve one note run into the inline CSS that paints it. */
export function noteRunStyle(run: TextRun): React.CSSProperties {
  const heading = run.heading ? NOTE_HEADING[run.heading] : null;
  const decorations: string[] = [];
  if (run.underline) decorations.push('underline');
  if (run.strikethrough) decorations.push('line-through');
  // A link reads as a link even without the underline toggle.
  if (noteRunHref(run) && !run.underline) decorations.push('underline');
  return {
    fontSize: `${heading?.px ?? (run.size ? NOTE_RUN_PX[run.size] : NOTE_BASE_PX)}px`,
    fontWeight: run.bold ? 700 : heading?.weight,
    fontStyle: run.italic ? 'italic' : undefined,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
    // An explicit run colour wins; a link otherwise takes the brand ink so
    // it's distinguishable from body text in both themes (the renderer and
    // the editor both sit on a light-or-dark surface, hence currentColor
    // rather than a fixed slate).
    color: run.color ?? (noteRunHref(run) ? 'var(--note-link-color)' : undefined),
    // Headings want a little air above them; margins don't survive inside a
    // contentEditable line, so the lift is line-height only.
    lineHeight: heading ? 1.45 : undefined,
  };
}
