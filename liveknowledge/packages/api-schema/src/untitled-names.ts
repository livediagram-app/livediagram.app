// The names a knowledgebase carries before anyone names it: the platform's list for every app's blank
// (@liveworkspace/api-schema/untitled-names) and liveknowledge's own, "Untitled Knowledgebase"
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase"). A light leaf, as the platform's is:
// the editor checks it on every first title.
import { UNTITLED_DOCUMENT_NAMES as PLATFORM_NAMES } from '@liveworkspace/api-schema/untitled-names';

export const UNTITLED_KNOWLEDGEBASE_NAME = 'Untitled Knowledgebase';

export const UNTITLED_DOCUMENT_NAMES: ReadonlySet<string> = new Set([
  ...PLATFORM_NAMES,
  UNTITLED_KNOWLEDGEBASE_NAME,
]);

/** Whether a knowledgebase still carries a default name, so the first title written in it may name it. */
export function isUntitledName(name: string): boolean {
  return UNTITLED_DOCUMENT_NAMES.has(name);
}
