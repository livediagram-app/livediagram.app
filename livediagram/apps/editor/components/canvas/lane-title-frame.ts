import type { CSSProperties } from 'react';
import { acrossTitleStrip, type LaneLike, type UprightTitleStrip } from '@livediagram/document';
import { uprightTitleFrame } from '@/components/canvas/upright-title';

/** A lane title's frame in its side strip: where the label (and its editor) lay out, and how it clips. */
export type LabelFrame = { style: CSSProperties; className?: string };

/**
 * The frame a lane's title renders in (docs/specs/009-elements/lane.md): turned in its strip for an upright title
 * ("Upright titles"), and for a title reading across a side gutter, the strip itself ("A title wraps in its gutter"),
 * so a title longer than the gutter is wide wraps there instead of running on into the lane's body. Past
 * LANE_TITLE_MAX_LINES (three) lines it ends in an ellipsis; the editor is never clamped, so every word stays
 * reachable while typing. Null for a band across the top or bottom, whose title has the lane's width.
 */
export function laneTitleFrame(
  el: LaneLike & { width: number; height: number },
  upright: UprightTitleStrip | null,
  isEditing: boolean,
): LabelFrame | null {
  if (upright) return { style: uprightTitleFrame(upright) };
  const strip = acrossTitleStrip(el, el.width, el.height);
  if (!strip) return null;
  return {
    style: {
      position: 'absolute',
      left: strip.x,
      top: strip.y,
      width: strip.width,
      height: strip.height,
      overflow: 'hidden',
    },
    // The label's text box (FixedSizeLabel's inner block) clamps; three is LANE_TITLE_MAX_LINES, spelled out
    // because Tailwind compiles only whole class names it can read.
    ...(isEditing ? {} : { className: '[&>div>div]:line-clamp-3' }),
  };
}
