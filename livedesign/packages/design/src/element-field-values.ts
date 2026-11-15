// The shared vocabularies (@liveworkspace/element-model/element-field-values), with livedesign's `font`: the eleven
// faces every product has, then the logo pages' display library (fonts.ts, docs/specs/004-interface-design/fonts.md
// "The display library"), so edit operations and the MCP accept a display face and refuse anything else.
import {
  ELEMENT_FIELD_VALUES as SHARED_FIELD_VALUES,
  fieldValueIssue as sharedFieldValueIssue,
} from '@liveworkspace/element-model/element-field-values';
import { FONT_IDS } from './fonts';

export const ELEMENT_FIELD_VALUES: Readonly<Record<string, readonly string[]>> = {
  ...SHARED_FIELD_VALUES,
  font: FONT_IDS,
};

// Why a field's value is off its list, as a sentence ending in the values it takes; null when it fits or the field
// has no closed list. Every key but `font` is the shared check.
export function fieldValueIssue(key: string, value: unknown): string | null {
  if (key !== 'font') return sharedFieldValueIssue(key, value);
  if (value === undefined || value === null || FONT_IDS.includes(value as string)) return null;
  return `font ${JSON.stringify(value)} is not one of ${FONT_IDS.join(', ')}`;
}
