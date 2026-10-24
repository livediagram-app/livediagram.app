// The values a style field takes (docs/specs/024-agents/edit-operations.md "The vocabulary", docs/specs/015-api/mcp-server.md
// §4.4 "Values checked"): the closed vocabularies of the stored fields an agent writes most, in one place, so an
// edit operation's `set` and the MCP's whole-element check refuse the same values the same way. A value off its list
// used to be stored and drawn wrong in silence (`textSize: "xl"` drew tiny overlapping text).

import { ACCENT_EDGES } from './accent-edge';
import { ARROWHEAD_SHAPES } from './arrow-style';
import { ATTACH_POINTS } from './attachment';
import { BORDER_DASH_ARRAY } from '@liveworkspace/document-core/border-style';
import { BOUNDARY_STYLES } from './boundary';
import { CARD_MEDIA } from './card';
import { CHIP_LOOKS } from './chip';
import { PYRAMID_VARIANTS } from './concept';
import { FONTS } from '@liveworkspace/document-core/fonts';
import { ICON_WEIGHTS } from '@liveworkspace/document-core/icon-weight';
import { STACK_ALIGNS, STACK_DIRECTIONS } from './stack';

export const ELEMENT_FIELD_VALUES: Readonly<Record<string, readonly string[]>> = {
  textSize: ['sm', 'md', 'lg', 'scale'],
  textAlignX: ['left', 'center', 'right'],
  textAlignY: ['top', 'middle', 'bottom'],
  iconPosition: ['left', 'right', 'above', 'below'],
  arrowStyle: ['straight', 'angled', 'curved'],
  arrowEnds: ['to', 'from', 'both', 'none'],
  arrowheadShape: ARROWHEAD_SHAPES,
  arrowheadStartShape: ARROWHEAD_SHAPES,
  strokeStyle: Object.keys(BORDER_DASH_ARRAY),
  borderRadius: ['none', 'sm', 'md', 'lg', 'full'],
  // The diagram-building kinds (docs/specs/009-elements/): accent edge, card, badge / step, boundary, pyramid.
  accentEdge: ACCENT_EDGES,
  cardMedia: CARD_MEDIA,
  chipLook: CHIP_LOOKS,
  attachAt: ATTACH_POINTS,
  boundaryStyle: BOUNDARY_STYLES,
  pyramidVariant: PYRAMID_VARIANTS,
  // Round 2 (docs/specs/009-elements/stack.md, org-chart.md, sequence-diagram.md).
  stackDirection: STACK_DIRECTIONS,
  stackAlign: STACK_ALIGNS,
  mindLook: ['person'],
  sequenceAnim: ['play'],
  // A line-art icon's stroke (icon-weight.ts): an icon's strokeWidth is not its weight.
  iconWeight: ICON_WEIGHTS,
  // The editor's faces (fonts.ts): a family name ("serif", "Georgia") drew in the tab's font in silence.
  font: FONTS.map((f) => f.id),
};

// Why a field's value is off its list, as a sentence ending in the values it takes; null when it fits or the field
// has no closed list.
export function fieldValueIssue(key: string, value: unknown): string | null {
  const values = Object.hasOwn(ELEMENT_FIELD_VALUES, key) ? ELEMENT_FIELD_VALUES[key]! : null;
  if (!values || value === undefined || value === null || values.includes(value as string))
    return null;
  // A text size may also be a pixel number (a custom size, or the one a Step number derives from its disc); the
  // renderer clamps it, so any finite number fits.
  if (key === 'textSize' && typeof value === 'number' && Number.isFinite(value)) return null;
  return `${key} ${JSON.stringify(value)} is not one of ${values.join(', ')}`;
}
