// Default folders (docs/specs/013-workspace/default-folders.md, blueprint
// docs/specs/013-workspace/blueprints/default-folders.md): where a person's new documents land when
// no place is chosen, keyed by what the document is made as. liveworkspace's index resolves and stores them; the
// editor and the MCP server send the creation intent, which the api hands the index as `indexIntentOf`.
//
// Three honest dimensions, most specific first: the first tab's kind (a specific kind such as an
// event-storming board), the template family it was made from (a retrospective), and the editor mode it opens in.
// Each comes from one closed list, so a new editor mode adds its Default Folders entry here unasked.

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

/** The specific tab kinds: every creatable kind but the general tab. Each has a `kind:` key. */
export type SpecificTabKind = Exclude<CreationTabKind, 'diagram'>;
const isSpecificTabKind = (kind: CreationTabKind): kind is SpecificTabKind =>
  kind !== DEFAULT_TAB_KIND;
export const SPECIFIC_TAB_KINDS: readonly SpecificTabKind[] =
  CREATION_TAB_KINDS.filter(isSpecificTabKind);

/** The template families: ordinary diagram tabs made from a family of templates. The map from each
 *  template to its family is `templateFamilyOf` in `@livediagram/templates`. */
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
  draw: { label: 'Whiteboards', noun: 'whiteboards' },
  workshop: { label: 'Sessions', noun: 'sessions' },
};
const KIND_WORDS: Record<SpecificTabKind, EntryWords> = {
  'event-storming': { label: 'Event Storming boards', noun: 'Event Storming boards' },
};

/** Default Folders' entries for each editor mode and specific tab kind, as the shared Explorer takes them
 *  (@liveworkspace/explorer DefaultFolderOption), between "Canvases" and the template families: "Whiteboards" holds
 *  new canvases that open in Draw mode (`livediagram:mode:draw` at the index). Typed per dimension, so a new mode
 *  or kind does not compile until it is named here. */
export const DEFAULT_FOLDER_OPTIONS: readonly {
  dimension: 'mode' | 'kind';
  value: string;
  label: string;
  noun: string;
}[] = [
  ...EDITOR_MODES.map((mode) => ({ dimension: 'mode' as const, value: mode, ...MODE_WORDS[mode] })),
  ...SPECIFIC_TAB_KINDS.map((kind) => ({
    dimension: 'kind' as const,
    value: kind,
    ...KIND_WORDS[kind],
  })),
];

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

/** The intent the index files a create by (its default folders, docs/specs/013-workspace/default-folders.md):
 *  `mode:tabKind:templateFamily`, whose last part names the template family the index's defaults key on. Null for
 *  no intent. */
export function indexIntentOf(intent: CreationIntent | null): string | null {
  if (!intent) return null;
  return [intent.mode, intent.tabKind, intent.templateFamily].filter(Boolean).join(':');
}

