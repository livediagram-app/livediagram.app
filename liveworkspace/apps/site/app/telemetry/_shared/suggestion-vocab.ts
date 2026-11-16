// Test support for each app's computed-emitters.ts: the telemetry types canvas suggestions send, read off
// @liveworkspace/suggestions' telemetry.ts (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md
// "Telemetry") so the declared values cannot drift from what the package sends.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '../../../../../../packages/suggestions/src/telemetry.ts'),
  'utf8',
);

// Every quoted token in the list that follows `marker`.
function listAfter(marker: string): string[] {
  const start = SOURCE.indexOf(marker);
  if (start < 0) return [];
  const block = SOURCE.slice(start, SOURCE.indexOf(']', start));
  return [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]!);
}

/** `Element·Changed`, from each editor's useEditorSuggestions. */
export const CANVAS_SUGGESTION_TYPES = listAfter('export const CANVAS_SUGGESTION_TYPES');

/** `<Item>·Shared`, from each editor's Share dialog Suggestions section. */
export const SUGGEST_ONLY_SHARE_TYPES = listAfter('export const SUGGEST_ONLY_SHARE_TYPES');

/** livedocuments' Assistants Suggest, in the same section. */
export const ASSISTANTS_SUGGEST_SHARE_TYPES = listAfter(
  'export const ASSISTANTS_SUGGEST_SHARE_TYPES',
);
