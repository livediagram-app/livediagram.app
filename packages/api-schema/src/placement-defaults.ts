// Default folders (docs/specs/013-workspace/default-folders.md, blueprint
// docs/specs/013-workspace/blueprints/default-folders.md): where a person's new documents land when
// no place is chosen, keyed by what the document is made as. The api resolves and stores them; the
// editor and the MCP server send the creation intent; all read the keys and the intent from here.
//
// Three honest dimensions, most specific first: the first tab's kind (a specific kind such as an
// event-storming board), the template family it was made from (a retrospective, a Kanban board),
// and the editor mode it opens in. Each comes from one closed list, and the keys are generated from
// them, so a new editor mode adds its key here unasked.

import {
  DEFAULT_TAB_KIND,
  EDITOR_MODES,
  isEditorMode,
  isEventStormingTab,
  type EditorMode,
  type Layer,
  type TabKind,
} from '@livediagram/document';

/** The dimensions of a default key, most specific first: the order a create's keys are tried in. */
export const DEFAULT_KEY_DIMENSIONS = ['kind', 'template', 'mode'] as const;

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
export const TEMPLATE_FAMILIES = ['retrospective', 'kanban'] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

/** What a new document is made as, captured once when it is created: the create body's `intent`. */
export type CreationIntent = {
  mode: EditorMode;
  tabKind: CreationTabKind;
  templateFamily?: TemplateFamily;
};

export type PlacementDefaultKey =
  `mode:${EditorMode}` | `kind:${SpecificTabKind}` | `template:${TemplateFamily}`;

/** The default keys, `<dimension>:<value>`, in the order the "New documents that open as" list
 *  shows them: one per editor mode, per specific tab kind, per template family, all generated. */
export const PLACEMENT_DEFAULT_KEYS: readonly PlacementDefaultKey[] = [
  ...EDITOR_MODES.map((mode) => `mode:${mode}` as const),
  ...SPECIFIC_TAB_KINDS.map((kind) => `kind:${kind}` as const),
  ...TEMPLATE_FAMILIES.map((family) => `template:${family}` as const),
];

/** One person's default folder for one key, as `GET /api/placement-defaults` answers it. */
export type PlacementDefault = { key: PlacementDefaultKey; folderId: string };

/** The named refusals of the default-folder routes besides the shared `folder_not_found`. */
export const PLACEMENT_DEFAULT_REJECTIONS = [
  'default_key_invalid',
  'default_folder_invalid',
] as const;
export type PlacementDefaultRejection = (typeof PLACEMENT_DEFAULT_REJECTIONS)[number];

/** The create's refusal of a malformed `intent`. */
export const INTENT_INVALID = 'intent_invalid';

const isMember = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some((member) => member === value);

export function isPlacementDefaultKey(value: unknown): value is PlacementDefaultKey {
  return isMember(PLACEMENT_DEFAULT_KEYS, value);
}

export function isCreationTabKind(value: unknown): value is CreationTabKind {
  return isMember(CREATION_TAB_KINDS, value);
}

export function isTemplateFamily(value: unknown): value is TemplateFamily {
  return isMember(TEMPLATE_FAMILIES, value);
}

const pascal = (part: string) =>
  part
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

/** The telemetry value of a key (`Folder·Changed` / `Folder·Cleared`): `kind:event-storming` →
 *  `DefaultKindEventStorming`. Closed, as the keys are. */
export function placementDefaultTelemetryType(key: PlacementDefaultKey): string {
  return `Default${key.split(':').map(pascal).join('')}`;
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
    mode: isEditorMode(tab?.opensIn)
      ? tab.opensIn
      : tab?.kind === 'whiteboard'
        ? 'draw'
        : 'diagram',
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
  if (!isEditorMode(mode)) return { ok: false };
  const kind = tabKind ?? DEFAULT_TAB_KIND;
  if (!isCreationTabKind(kind)) return { ok: false };
  const intent: CreationIntent = { mode, tabKind: kind };
  if (templateFamily === undefined || templateFamily === null) return { ok: true, intent };
  if (!isTemplateFamily(templateFamily)) return { ok: false };
  return { ok: true, intent: { ...intent, templateFamily } };
}

/** Every key an intent names, most specific first: kind, template, mode. */
export function candidateKeysFor(intent: CreationIntent): string[] {
  const keys: string[] = [];
  if (isSpecificTabKind(intent.tabKind)) keys.push(`kind:${intent.tabKind}`);
  if (intent.templateFamily) keys.push(`template:${intent.templateFamily}`);
  keys.push(`mode:${intent.mode}`);
  return keys;
}

/** The keys a create with this intent tries, most specific first. */
export function defaultKeysFor(intent: CreationIntent): PlacementDefaultKey[] {
  return candidateKeysFor(intent).filter(isPlacementDefaultKey);
}
