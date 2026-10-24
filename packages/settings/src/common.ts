// The Settings panel's Common group, as plain data (liveworkspace/docs/accounts.md "Common settings",
// liveworkspace/docs/site.md "Settings"): every editor setting two or more apps have (COMMON_SETTING_KEYS), once,
// built from the apps' catalogues, in the categories the apps file them under. The apps word a common setting the
// same way and keep it under the same category ids, so the first app that has a row gives its wording; where they
// file it under a category of their own (Show Home Banner under Documents, Plans or Designs), PLATFORM_PLACES says
// where it goes instead.
//
// Pure data and helpers, with no editor code: the panel runs it once over the catalogues it has loaded (about 120
// rows in all; each placement scans only its own category's few rows).
import { isCommonSetting } from './index';
import type { AppCatalogue, CatalogueBinding, CatalogueCategory, CatalogueRow } from './catalogue';

// The stored values a row reads and writes: its own binding, or each switch's of a group.
export function rowBindings(row: CatalogueRow): readonly CatalogueBinding[] {
  return row.kind === 'toggleGroup' ? row.toggles : [row];
}

/** Whether a catalogue row is over common settings alone, so the All view draws it under Common. */
export function isCommonRow(row: CatalogueRow): boolean {
  const bindings = rowBindings(row);
  return bindings.length > 0 && bindings.every((binding) => isCommonSetting(binding.key));
}

/** An app's catalogue without its common rows: what its own group in the All view shows. A category left empty is
 *  kept, so a sub-category under it is still named by its path (the view leaves empty categories out). */
export function withoutCommonRows(catalogue: AppCatalogue): AppCatalogue {
  return {
    ...catalogue,
    categories: catalogue.categories.map((category) => ({
      ...category,
      rows: category.rows.filter((row) => !isCommonRow(row)),
    })),
  };
}

// Where a common setting goes when the apps file it under a category of their own, by its stored key.
export const PLATFORM_PLACES: Readonly<
  Record<string, { id: string; label: string; tile: string }>
> = {
  homeBanner: { id: 'explorer', label: 'Explorer', tile: 'folder' },
};

export interface CommonCatalogue {
  catalogue: AppCatalogue;
  // Each Common row's id, and the apps that have it, in the order given.
  apps: ReadonlyMap<string, readonly string[]>;
}

type Draft = {
  id: string;
  label: string;
  tile?: string;
  parent?: string;
  // The parent's name and tile in the app it came from, for when the parent isn't in Common.
  parentLabel?: string;
  parentTile?: string;
  sectionNotes?: Record<string, string>;
  collapsedSections?: string[];
  rows: CatalogueRow[];
};

// Puts `id` into `order` once: after `after` when given (the item before it where it was found), else at the front.
function place(order: string[], id: string, after: string | undefined): void {
  if (order.includes(id)) return;
  const at = after === undefined ? -1 : order.indexOf(after);
  order.splice(at + 1, 0, id);
}

const bindingId = (row: CatalogueRow) =>
  rowBindings(row)
    .map((binding) => (binding.field ? `${binding.key}.${binding.field}` : binding.key))
    .join(' ');

/** The Common group's catalogue, from the apps' catalogues in the order given (that order decides whose wording a
 *  row takes, and where a category or row only some apps have is put: after the one before it there). */
export function commonCatalogue(
  sources: readonly { app: string; catalogue: AppCatalogue }[],
): CommonCatalogue {
  const drafts = new Map<string, Draft>();
  const order: string[] = [];
  const apps = new Map<string, string[]>();
  // Each Common row's category, by the stored values it holds, so an app's copy of a row lands with the first one.
  const seen = new Map<string, { category: string; id: string }>();

  for (const { app, catalogue } of sources) {
    const byId = new Map(catalogue.categories.map((category) => [category.id, category]));
    let lastCategory: string | undefined;
    for (const category of catalogue.categories) {
      let lastRow: string | undefined;
      for (const row of category.rows) {
        if (!isCommonRow(row)) continue;
        const key = bindingId(row);
        const known = seen.get(key);
        if (known) {
          apps.get(known.id)?.push(app);
          lastCategory = known.category;
          lastRow = known.id;
          continue;
        }
        const platform = PLATFORM_PLACES[rowBindings(row)[0]!.key];
        const target = platform?.id ?? category.id;
        let draft = drafts.get(target);
        if (!draft) {
          draft = platform
            ? { id: platform.id, label: platform.label, tile: platform.tile, rows: [] }
            : newDraft(category, byId);
          drafts.set(target, draft);
        }
        if (target !== lastCategory) {
          place(order, target, lastCategory);
          lastCategory = target;
          lastRow = undefined;
        }
        // Under the platform's own category the app's section heading would only repeat it.
        const { section: _section, ...placed } = row;
        const added = platform ? placed : row;
        const at = lastRow === undefined ? -1 : draft.rows.findIndex((r) => r.id === lastRow);
        draft.rows.splice(at + 1, 0, added as CatalogueRow);
        seen.set(key, { category: target, id: row.id });
        apps.set(row.id, [app]);
        lastRow = row.id;
      }
    }
  }

  const shown = new Set(order);
  const categories = order.map((id): CatalogueCategory => {
    const draft = drafts.get(id)!;
    const nested = draft.parent !== undefined && shown.has(draft.parent);
    const sections = new Set(draft.rows.flatMap((row) => (row.section ? [row.section] : [])));
    const notes = Object.entries(draft.sectionNotes ?? {}).filter(([s]) => sections.has(s));
    const collapsed = (draft.collapsedSections ?? []).filter((s) => sections.has(s));
    const tile = nested ? undefined : (draft.tile ?? draft.parentTile);
    const ids = new Set(draft.rows.map((row) => row.id));
    return {
      id,
      // A sub-category whose parent isn't here is named by its path ("Editor › Pages").
      label:
        draft.parent !== undefined && !nested
          ? `${draft.parentLabel ?? draft.parent} › ${draft.label}`
          : draft.label,
      ...(nested ? { parent: draft.parent } : {}),
      ...(tile ? { tile } : {}),
      ...(notes.length > 0 ? { sectionNotes: Object.fromEntries(notes) } : {}),
      ...(collapsed.length > 0 ? { collapsedSections: collapsed } : {}),
      // A row stays nested under its switch only while that switch is here too.
      rows: draft.rows.map((row) => {
        if (row.parent === undefined || ids.has(row.parent)) return row;
        const { parent: _parent, ...rest } = row;
        return rest as CatalogueRow;
      }),
    };
  });
  return { catalogue: { categories, shared: [] }, apps };
}

function newDraft(
  category: CatalogueCategory,
  byId: ReadonlyMap<string, CatalogueCategory>,
): Draft {
  const parent = category.parent !== undefined ? byId.get(category.parent) : undefined;
  return {
    id: category.id,
    label: category.label,
    ...(category.tile ? { tile: category.tile } : {}),
    ...(category.parent !== undefined ? { parent: category.parent } : {}),
    ...(parent ? { parentLabel: parent.label } : {}),
    ...(parent?.tile ? { parentTile: parent.tile } : {}),
    ...(category.sectionNotes ? { sectionNotes: { ...category.sectionNotes } } : {}),
    ...(category.collapsedSections ? { collapsedSections: [...category.collapsedSections] } : {}),
    rows: [],
  };
}
