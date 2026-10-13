// The values a style field takes (docs/specs/024-agents/edit-operations.md "The vocabulary", docs/specs/015-api/mcp-server.md
// §4.4 "Values checked"): the closed vocabularies of the stored fields an agent writes most, in one place, so an
// edit operation's `set` and the MCP's whole-element check refuse the same values the same way. A value off its list
// used to be stored and drawn wrong in silence (`textSize: "xl"` drew tiny overlapping text).

import { ARROWHEAD_SHAPES } from './arrow-style';
import { BORDER_DASH_ARRAY } from './border-style';

export const ELEMENT_FIELD_VALUES: Readonly<Record<string, readonly string[]>> = {
  textSize: ['sm', 'md', 'lg', 'scale'],
  textAlignX: ['left', 'center', 'right'],
  textAlignY: ['top', 'middle', 'bottom'],
  iconPosition: ['left', 'right', 'above', 'below'],
  arrowStyle: ['straight', 'angled', 'curved'],
  arrowEnds: ['to', 'from', 'both', 'none'],
  arrowheadShape: ARROWHEAD_SHAPES,
  strokeStyle: Object.keys(BORDER_DASH_ARRAY),
  borderRadius: ['none', 'sm', 'md', 'lg', 'full'],
};

// Why a field's value is off its list, as a sentence ending in the values it takes; null when it fits or the field
// has no closed list.
export function fieldValueIssue(key: string, value: unknown): string | null {
  const values = Object.hasOwn(ELEMENT_FIELD_VALUES, key) ? ELEMENT_FIELD_VALUES[key]! : null;
  if (!values || value === undefined || value === null || values.includes(value as string))
    return null;
  return `${key} ${JSON.stringify(value)} is not one of ${values.join(', ')}`;
}
