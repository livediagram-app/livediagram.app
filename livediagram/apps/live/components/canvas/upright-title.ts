import type { CSSProperties } from 'react';
import type { UprightTitleStrip } from '@livediagram/document';

/**
 * The frame an upright lane title renders in (docs/specs/009-elements/lane.md "Upright titles"): a
 * box as long as the strip is tall, turned a quarter anticlockwise about its top-left corner from
 * the strip's bottom-left, so the text reads bottom to top and the editor turns with it. A title
 * longer than its lines allow is clipped.
 */
export function uprightTitleFrame(strip: UprightTitleStrip): CSSProperties {
  return {
    position: 'absolute',
    left: strip.x,
    top: strip.y + strip.height,
    width: strip.height,
    height: strip.width,
    transform: 'rotate(-90deg)',
    transformOrigin: '0 0',
    overflow: 'hidden',
  };
}
