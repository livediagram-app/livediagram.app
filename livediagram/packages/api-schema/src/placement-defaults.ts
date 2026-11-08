// Default folders (docs/specs/013-workspace/default-folders.md): where a person's new documents land when
// no place is chosen, keyed by the editor mode the document opens in alone: Diagrams, Drawings, Workshops.
// liveworkspace's index resolves and stores them; the editor and the MCP server send the creation intent, which
// the api hands the index as `indexIntentOf`.
//
// The intent still records the first tab's kind and the template family (the Explorer's filters read them), but
// livediagram is a mode-only app at the index (index-client MODE_ONLY_PLACEMENT_APPS), so only the mode files a
// create. EDITOR_MODES is one closed list, so a new editor mode adds its Default Folders entry here unasked.

import {
  DEFAULT_TAB_KIND,
  EDITOR_MODES,
  isEventStormingTab,
  parseEditorMode,
  type EditorMode,
  type Layer,
  type TabKind,
} from '@livediagram/document';

/** The tab kinds a document can be created with. The legacy `whiteboard` kind is not one: a
 *  whiteboard is a general tab that opens in Draw mode. */
export const CREATION_TAB_KINDS = [
  'diagram',
  'event-storming',
] as const satisfies readonly TabKind[];
export type CreationTabKind = (typeof CREATION_TAB_KINDS)[number];

/** The template families: ordinary diagram tabs made from a family of templates, recorded on the intent for the
 *  Explorer's filters (no Default Folders entry). The map from each template to its family is `templateFamilyOf`
 *  in `@livediagram/templates`. */
export const TEMPLATE_FAMILIES = ['retrospective'] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

/** What a new document is made as, captured once when it is created: the create body's `intent`. */
export type CreationIntent = {
  mode: EditorMode;
  tabKind: CreationTabKind;
  templateFamily?: TemplateFamily;
};

type EntryWords = { label: string; noun: string };
const MODE_WORDS: Record<EditorMode, EntryWords> = {
  diagram: { label: 'Diagrams', noun: 'diagrams' },
  draw: { label: 'Drawings', noun: 'drawings' },
  workshop: { label: 'Workshops', noun: 'workshops' },
};

/** Default Folders' entries, one per editor mode and nothing else, as the shared Explorer takes them
 *  (@liveworkspace/explorer DefaultFolderOption): "Drawings" holds new canvases that open in Draw mode
 *  (`livediagram:mode:draw` at the index). Typed per mode, so a new mode does not compile until it is named here. */
export const DEFAULT_FOLDER_OPTIONS: readonly {
  dimension: 'mode' | 'kind';
  value: string;
  label: string;
  noun: string;
}[] = EDITOR_MODES.map((mode) => ({
  dimension: 'mode' as const,
  value: mode,
  ...MODE_WORDS[mode],
}));

/** The create's refusal of a malformed `intent`. */
export const INTENT_INVALID = 'intent_invalid';

const isMember = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some((member) => member === value);

export function isCreationTabKind(value: unknown): value is CreationTabKind {
  return isMember(CREATION_TAB_KINDS, value);
}

export function isTemplateFamily(value: unknown): value is TemplateFamily {
  return isMember(TEMPLATE_FAMILIES, value);
}

/**
 * The creation intent of a new document, from its first tab and the family of the template it was
 * made from. Structural, so it reads a tab from before editor modes (a legacy `kind: 'whiteboard'`
 * opens in Draw mode) and one after (`opensIn`); the tab kind is read the way the document model
 * reads it, legacy event-storming boards included.
 */
export function creationIntentOf(
  tab: { kind?: string; opensIn?: string; layers?: Layer[] } | undefined,
  templateFamily: TemplateFamily | null = null,
): CreationIntent {
  const intent: CreationIntent = {
    mode: parseEditorMode(tab?.opensIn) ?? (tab?.kind === 'whiteboard' ? 'draw' : 'diagram'),
    tabKind: isEventStormingTab(tab) ? 'event-storming' : 'diagram',
  };
  return templateFamily ? { ...intent, templateFamily } : intent;
}

/** A create body's `intent`: none when absent or null, refused (`intent_invalid`) when malformed.
 *  An absent or null `tabKind` is the general tab; an absent or null `templateFamily` is none. */
export function readCreationIntent(
  value: unknown,
): { ok: true; intent: CreationIntent | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, intent: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const { mode, tabKind, templateFamily } = value as {
    mode?: unknown;
    tabKind?: unknown;
    templateFamily?: unknown;
  };
  // A create from a client from before a mode's rename still names it `facilitate`; one naming Pages mode (or its
  // older names) is made in Diagram.
  const parsedMode = parseEditorMode(mode);
  if (!parsedMode) return { ok: false };
  const kind = tabKind ?? DEFAULT_TAB_KIND;
  if (!isCreationTabKind(kind)) return { ok: false };
  const intent: CreationIntent = { mode: parsedMode, tabKind: kind };
  if (templateFamily === undefined || templateFamily === null) return { ok: true, intent };
  if (!isTemplateFamily(templateFamily)) return { ok: false };
  return { ok: true, intent: { ...intent, templateFamily } };
}

/** The intent the index records a create with: `mode:tabKind:templateFamily`. The index files it by its mode
 *  alone (livediagram is a mode-only app, docs/specs/013-workspace/default-folders.md "Filing on create"); the last
 *  part names the template family the Explorer's filters read. Null for no intent. */
export function indexIntentOf(intent: CreationIntent | null): string | null {
  if (!intent) return null;
  return [intent.mode, intent.tabKind, intent.templateFamily].filter(Boolean).join(':');
}
