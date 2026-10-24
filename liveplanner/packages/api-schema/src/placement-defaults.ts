// Default folders (docs/specs/013-workspace/default-folders.md, blueprint
// docs/specs/013-workspace/blueprints/default-folders.md): where a person's new projects land when
// no place is chosen, keyed by what the project is made as. The api resolves and stores them; the
// editor and the MCP server send the creation intent; all read the keys and the intent from here.
//
// Two honest dimensions, most specific first: the template family it was made from (a
// retrospective, a Kanban board), and the editor mode it opens in (Plan, docs/specs/026-plan/plan-mode.md). Each comes from one closed list,
// and the
// keys are generated from them.

import {
  EDITOR_MODES,
  PLAN_TAB_KINDS,
  isPlanTabKind,
  parseEditorMode,
  type EditorMode,
  type PlanTabKind,
} from '@liveplanner/project';

/** The dimensions of a default key, most specific first: the order a create's keys are tried in. */
export const DEFAULT_KEY_DIMENSIONS = ['template', 'mode'] as const;

/** What a project's first tab was when it was created: a Board, Sheet, Dashboard or Form tab, or `empty` for a
 *  tab of none of those kinds (a blank tab) or no tab at all. */
export const CREATION_TAB_KINDS = [...PLAN_TAB_KINDS, 'empty'] as const;
export type CreationTabKind = PlanTabKind | 'empty';

/** The template families: projects made from a family of templates. The map from each template to its family is
 *  `templateFamilyOf` in `@liveplanner/templates`. */
export const TEMPLATE_FAMILIES = ['retrospective', 'kanban'] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

/** What a new project is made as, captured once when it is created: the create body's `intent`. */
export type CreationIntent = {
  mode: EditorMode;
  tabKind: CreationTabKind;
  templateFamily?: TemplateFamily;
};

export type PlacementDefaultKey = `mode:${EditorMode}` | `template:${TemplateFamily}`;

/** The default keys, `<dimension>:<value>`, in the order the "New projects that open as" list
 *  shows them: one per editor mode and per template family, all generated. */
export const PLACEMENT_DEFAULT_KEYS: readonly PlacementDefaultKey[] = [
  ...EDITOR_MODES.map((mode) => `mode:${mode}` as const),
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

/** The telemetry value of a key (`Folder·Changed` / `Folder·Cleared`): `template:retrospective` →
 *  `DefaultTemplateRetrospective`. Closed, as the keys are. */
export function placementDefaultTelemetryType(key: PlacementDefaultKey): string {
  return `Default${key.split(':').map(pascal).join('')}`;
}

/** The kind a first tab is created as: its Plan kind, or `empty`. */
export function creationTabKindOf(tab: { kind?: string } | undefined): CreationTabKind {
  return isPlanTabKind(tab?.kind) ? tab.kind : 'empty';
}

/**
 * The creation intent of a new project, from its first tab and the family of the template it was
 * made from. Structural; the tab kind is read the way the project model reads it.
 */
export function creationIntentOf(
  tab: { kind?: string } | undefined,
  templateFamily: TemplateFamily | null = null,
): CreationIntent {
  const intent: CreationIntent = { mode: 'plan', tabKind: creationTabKindOf(tab) };
  return templateFamily ? { ...intent, templateFamily } : intent;
}

/** A create body's `intent`: none when absent or null, refused (`intent_invalid`) when malformed.
 *  An absent or null `tabKind` is `empty`; an absent or null `templateFamily` is none. */
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
  // A create from an older client still names a retired mode, read as Plan.
  const parsedMode = parseEditorMode(mode);
  if (!parsedMode) return { ok: false };
  const kind = tabKind ?? 'empty';
  if (!isCreationTabKind(kind)) return { ok: false };
  const intent: CreationIntent = { mode: parsedMode, tabKind: kind };
  if (templateFamily === undefined || templateFamily === null) return { ok: true, intent };
  if (!isTemplateFamily(templateFamily)) return { ok: false };
  return { ok: true, intent: { ...intent, templateFamily } };
}

/** The intent as the index keeps it, a word for its filters and default folders: `plan:board`,
 *  `plan:empty:kanban` (its last part the template family the index's defaults key on). Null for none. */
export function indexIntentOf(intent: CreationIntent | null): string | null {
  if (!intent) return null;
  return [intent.mode, intent.tabKind, intent.templateFamily].filter(Boolean).join(':');
}

/** Every key an intent names, most specific first: template, mode. */
export function candidateKeysFor(intent: CreationIntent): string[] {
  const keys: string[] = [];
  if (intent.templateFamily) keys.push(`template:${intent.templateFamily}`);
  keys.push(`mode:${intent.mode}`);
  return keys;
}

/** The keys a create with this intent tries, most specific first. */
export function defaultKeysFor(intent: CreationIntent): PlacementDefaultKey[] {
  return candidateKeysFor(intent).filter(isPlacementDefaultKey);
}
