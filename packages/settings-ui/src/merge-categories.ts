// The Settings panel's one set of categories (liveworkspace/docs/specs/010-site/site.md "Settings", "One set of categories"):
// Common's and every app's categories merged by their place, the category's name under its parent's ("Editor",
// "Account › Notifications"), so two apps' Editor are one Editor. Inside a merged category each section shows
// once, holding every app's rows filed under it (section-order.ts), and each setting is one row: Common's, which every
// app that has it reads from `all`, and any row two apps keep under the same key with the same meaning, which writes to
// each of them. Every row carries the apps it applies to (`SettingsRow.apps`), drawn as their logos; `only` keeps the
// rows that apply to one app (the header's This App side), and the categories left with any.
//
// Every id the old per-app layout used (`common:editor`, `livediagram.app:editor`) and each category's bare id
// (`editor`) is kept as an alias of the merged category, so a remembered category or a deep link lands on it; so are
// the ids a category carries for ones folded into it (`aliases`: Editor's old `draw`, `livediagram.app:draw`, and
// from Common `common:pages`), and an old merged place a category carries as a path (Presenting's `/editor/presenting`
// answers to `apps:editor/presenting`, the Explorer's `/canvases` to `apps:canvases`).
//
// Linear in rows and categories: one pass files every category and row by key, one more lays them out. The panel
// runs it when it opens and again only when a value changes (panelModel's memo).
import { shortLabel } from './catalogue-model';
import type { SettingsCategory, SettingsRow, SettingsSectionNote } from './model';
import { bySection } from './section-order';

export type MergeSource = {
  // The prefix every id of this source carries (`common`, `livediagram.app`): groupCategories'.
  group: string;
  // Common's: each setting already once, never merged again with an app's row of the same key.
  shared?: boolean;
  // The source's categories as it nests them, empty ones kept (catalogueModel's `structure`), ids prefixed. Each row
  // carries its `apps`.
  categories: readonly SettingsCategory[];
};

type Entry = { row: SettingsRow; source: MergeSource; local: string };

type Node = {
  key: string;
  path: string[];
  entries: Entry[];
  aliases: string[];
  topIcon?: SettingsCategory['icon'];
  nestedIcon?: SettingsCategory['icon'];
  sectionNotes?: Record<string, SettingsSectionNote>;
  collapsed?: Set<string>;
  next: Node | null;
};

const localId = (group: string, id: string) =>
  id.startsWith(`${group}:`) ? id.slice(group.length + 1) : id;

const keyOf = (path: readonly string[]) =>
  path.map((part) => part.trim().toLowerCase()).join(' › ');

const slug = (path: readonly string[]) =>
  path
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .join('/');

// What a row stores and how it is changed, beyond its key: two apps' rows are one only when these agree.
function shape(row: SettingsRow): string | null {
  switch (row.kind) {
    case 'toggle':
      return 'toggle';
    case 'choice':
      return `choice:${row.options.map((o) => o.id).join(',')}`;
    case 'slider':
      return `slider:${row.min}:${row.max}:${row.step}`;
    case 'toggleGroup':
      return `toggleGroup:${row.toggles.map((t) => t.key).join(',')}`;
    default:
      // Links, notes, readouts and an app's own drawn rows are never merged.
      return null;
  }
}

// One row standing for the same setting in several apps: it shows the first app's value and a change goes to every
// one of them, each through its own row, so each app saves and counts it as its own Settings does. It applies to
// every app any of them applies to.
function fanOut(rows: readonly SettingsRow[]): SettingsRow {
  const apps = [...new Set(rows.flatMap((row) => row.apps ?? []))];
  return { ...fanOutChange(rows), apps };
}

function fanOutChange(rows: readonly SettingsRow[]): SettingsRow {
  const first = rows[0]!;
  switch (first.kind) {
    case 'toggle':
      return {
        ...first,
        onChange: (next: boolean) => {
          for (const row of rows) if (row.kind === 'toggle') row.onChange(next);
        },
      };
    case 'choice':
      return {
        ...first,
        onChange: (next: string) => {
          for (const row of rows) if (row.kind === 'choice') row.onChange(next);
        },
      };
    case 'slider':
      return {
        ...first,
        onCommit: (next: number) => {
          for (const row of rows) if (row.kind === 'slider') row.onCommit(next);
        },
      };
    case 'toggleGroup':
      return {
        ...first,
        toggles: first.toggles.map((toggle, i) => ({
          ...toggle,
          onChange: (next: boolean) => {
            for (const row of rows) {
              if (row.kind === 'toggleGroup') row.toggles[i]?.onChange(next);
            }
          },
        })),
      };
    default:
      return first;
  }
}

// Whether a row is shown where the panel keeps one app's settings (`only`): a row that names no apps always is.
const appliesTo = (row: SettingsRow, only: string | undefined) =>
  only === undefined || !row.apps || row.apps.includes(only);

export function mergeAppCategories(
  sources: readonly MergeSource[],
  group: string,
  { only }: { only?: string } = {},
): SettingsCategory[] {
  const nodes = new Map<string, Node>();
  let head = null as Node | null;
  let tail = null as Node | null;
  const insertAfter = (node: Node, after: Node | null) => {
    if (!after) {
      if (tail) tail.next = node;
      else head = node;
      tail = node;
      return;
    }
    node.next = after.next;
    after.next = node;
    if (tail === after) tail = node;
  };

  // 1. File every category by its place, and its rows in order.
  for (const source of sources) {
    const byId = new Map(source.categories.map((c) => [c.id, c]));
    const paths = new Map<string, string[]>();
    const pathOf = (category: SettingsCategory, depth = 0): string[] => {
      const known = paths.get(category.id);
      if (known) return known;
      const parent = category.parent !== undefined ? byId.get(category.parent) : undefined;
      const path =
        parent && depth < 4
          ? [...pathOf(parent, depth + 1), category.label]
          : category.label.split(' › ');
      paths.set(category.id, path);
      return path;
    };
    let previous: Node | null = null;
    for (const category of source.categories) {
      const path = pathOf(category);
      const key = keyOf(path);
      let node = nodes.get(key);
      if (!node) {
        node = { key, path, entries: [], aliases: [], next: null };
        nodes.set(key, node);
        insertAfter(node, previous);
      }
      previous = node;
      node.aliases.push(category.id, localId(source.group, category.id));
      // A category folded into this one (Editor's old `draw`): its bare and prefixed ids, and the merged id it had
      // beneath this one (`apps:editor/draw`), land here too.
      for (const alias of category.aliases ?? []) {
        // An old place in the merged rail, written as its path (`/editor/presenting`, Presenting's while it sat under
        // Editor; `/canvases`, before Canvases joined the Explorer): its merged id.
        if (alias.startsWith('/')) {
          node.aliases.push(`${group}:${alias.slice(1)}`);
          continue;
        }
        const bare = localId(source.group, alias);
        node.aliases.push(bare, `${source.group}:${bare}`, `${group}:${slug([...path, bare])}`);
      }
      const nested = category.parent !== undefined && byId.has(category.parent);
      if (category.icon !== undefined) {
        if (nested) node.nestedIcon ??= category.icon;
        else node.topIcon ??= category.icon;
      }
      // A section's note from the first source that has one; a section closed in any source stays closed.
      if (category.sectionNotes) {
        node.sectionNotes = { ...category.sectionNotes, ...node.sectionNotes };
      }
      if (category.collapsedSections) {
        node.collapsed ??= new Set();
        for (const s of category.collapsedSections) node.collapsed.add(s);
      }
      for (const row of category.rows) {
        node.entries.push({ row, source, local: localId(source.group, row.key) });
      }
    }
  }

  // 2. Lay out each category's rows: each setting once, each section once, only the ones `only` keeps.
  const rowAlias = new Map<string, string>();
  const built = new Map<Node, SettingsRow[]>();
  for (const node of nodes.values()) {
    if (node.entries.length === 0) continue;
    // The same setting in two or more apps: the same key, control and wording.
    const bySignature = new Map<string, Entry[]>();
    for (const entry of node.entries) {
      if (entry.source.shared) continue;
      const kind = shape(entry.row);
      if (kind === null) continue;
      const signature = `${entry.local}\u0000${kind}\u0000${entry.row.label}`;
      const list = bySignature.get(signature);
      if (list) list.push(entry);
      else bySignature.set(signature, [entry]);
    }
    const mergedOf = new Map<Entry, SettingsRow | null>();
    for (const list of bySignature.values()) {
      if (list.length < 2) continue;
      const row = fanOut(list.map((e) => e.row));
      list.forEach((entry, i) => {
        mergedOf.set(entry, i === 0 ? row : null);
        if (i > 0) rowAlias.set(entry.row.key, row.key);
      });
    }
    const rows: SettingsRow[] = [];
    for (const entry of node.entries) {
      const merged = mergedOf.get(entry);
      if (merged === null) continue;
      const row = merged ?? entry.row;
      if (appliesTo(row, only)) rows.push(row);
    }
    if (rows.length > 0) built.set(node, bySection(rows));
  }

  // 3. Which categories show, nested where their parent shows too, and their ids.
  const parentOf = (node: Node) =>
    node.path.length > 1 ? nodes.get(keyOf(node.path.slice(0, -1))) : undefined;
  const ids = new Map<Node, string>();
  for (const node of nodes.values()) ids.set(node, `${group}:${slug(node.path)}`);
  // How many shown categories stand at the top level for want of each parent ("Panels" in "Panels › Map").
  const orphans = new Map<string, number>();
  for (const node of built.keys()) {
    const parent = parentOf(node);
    if (node.path.length > 1 && !(parent && built.has(parent))) {
      const name = node.path.slice(0, -1).join(' › ');
      orphans.set(name, (orphans.get(name) ?? 0) + 1);
    }
  }

  const out: SettingsCategory[] = [];
  for (let node: Node | null = head; node; node = node.next) {
    const layout = built.get(node);
    const id = ids.get(node)!;
    if (!layout) continue;
    const parent = parentOf(node);
    const nested = parent !== undefined && built.has(parent);
    const label = nested
      ? node.path.at(-1)!
      : node.path.length > 1
        ? shortLabel(node.path.join(' › '), orphans)
        : node.path[0]!;
    const icon = nested ? node.nestedIcon : (node.topIcon ?? parent?.topIcon);
    out.push({
      id,
      label,
      group,
      ...(nested ? { parent: ids.get(parent)! } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(node.sectionNotes ? { sectionNotes: node.sectionNotes } : {}),
      ...(node.collapsed ? { collapsedSections: [...node.collapsed] } : {}),
      aliases: [...new Set(node.aliases)].filter((alias) => alias !== id),
      rows: layout,
    });
  }

  // 4. A nested row whose switch was merged into another app's sits under the merged one.
  if (rowAlias.size === 0) return out;
  return out.map((c) => ({
    ...c,
    rows: c.rows.map((r) => {
      const parent = r.parent !== undefined ? rowAlias.get(r.parent) : undefined;
      return parent !== undefined ? { ...r, parent } : r;
    }),
  }));
}
