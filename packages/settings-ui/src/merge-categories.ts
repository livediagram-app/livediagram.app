// The All view's one set of categories (liveworkspace/docs/specs/010-site/site.md "Settings", "All"): Common's and every app's
// categories merged by their place, the category's name under its parent's ("Editor", "Editor › Draw",
// "Panels › Layers"), so two apps' Editor are one Editor. Inside a merged category the shared rows come first (Common's,
// which every app that has them reads from `all`, and any row two apps keep under the same key with the same
// meaning, which writes to each of them), then each app's own rows under its logo and name (`SettingsRow.app`,
// `SettingsCategory.appHeadings`). A category only one app has is still listed once, under its own name.
//
// Every id the old per-app layout used (`common:editor`, `livediagram.app:draw`) and each category's bare id
// (`editor`) is kept as an alias of the merged category, so a remembered category or a deep link lands on it.
//
// Linear in rows and categories: one pass files every category and row by key, one more lays them out. The panel
// runs it when All opens and again only when a value changes (panelModel's memo).
import { shortLabel } from './catalogue-model';
import type {
  SettingsAppHeading,
  SettingsCategory,
  SettingsRow,
  SettingsSectionNote,
} from './model';

export type MergeSource = {
  // The prefix every id of this source carries (`common`, `livediagram.app`): groupCategories'.
  group: string;
  // An app's sub-heading for its own rows. Absent: the rows are shared (Common), drawn first with no sub-heading.
  heading?: SettingsAppHeading;
  // The source's categories as it nests them, empty ones kept (catalogueModel's `structure`), ids prefixed.
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
  appHeadings?: Record<
    string,
    {
      label: string;
      icon?: SettingsAppHeading['icon'];
      sectionNotes?: Record<string, SettingsSectionNote>;
      collapsedSections?: string[];
    }
  >;
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
// one of them, each through its own row, so each app saves and counts it as its own Settings does.
function fanOut(rows: readonly SettingsRow[]): SettingsRow {
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

export function mergeAppCategories(
  sources: readonly MergeSource[],
  group: string,
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
      const nested = category.parent !== undefined && byId.has(category.parent);
      if (category.icon !== undefined) {
        if (nested) node.nestedIcon ??= category.icon;
        else node.topIcon ??= category.icon;
      }
      if (source.heading) {
        node.appHeadings ??= {};
        const heading = (node.appHeadings[source.group] ??= {
          label: source.heading.label,
          ...(source.heading.icon !== undefined ? { icon: source.heading.icon } : {}),
          ...(source.heading.sectionNotes
            ? { sectionNotes: { ...source.heading.sectionNotes } }
            : {}),
          ...(source.heading.collapsedSections
            ? { collapsedSections: [...source.heading.collapsedSections] }
            : {}),
        });
        if (category.sectionNotes) {
          heading.sectionNotes = { ...category.sectionNotes, ...heading.sectionNotes };
        }
        if (category.collapsedSections) {
          heading.collapsedSections = [
            ...(heading.collapsedSections ?? []),
            ...category.collapsedSections,
          ];
        }
      } else {
        if (category.sectionNotes) {
          node.sectionNotes = { ...category.sectionNotes, ...node.sectionNotes };
        }
        if (category.collapsedSections) {
          node.collapsed ??= new Set();
          for (const s of category.collapsedSections) node.collapsed.add(s);
        }
      }
      for (const row of category.rows) {
        node.entries.push({ row, source, local: localId(source.group, row.key) });
      }
    }
  }

  // 2. Lay out each category's rows: shared first, then each app's own under its heading.
  const rowAlias = new Map<string, string>();
  const built = new Map<Node, { rows: SettingsRow[]; heldApps: Set<string> }>();
  for (const node of nodes.values()) {
    if (node.entries.length === 0) continue;
    // The same setting in two or more apps: the same key, control and wording.
    const bySignature = new Map<string, Entry[]>();
    for (const entry of node.entries) {
      if (!entry.source.heading) continue;
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
    const shared: SettingsRow[] = [];
    const own: SettingsRow[] = [];
    const heldApps = new Set<string>();
    for (const entry of node.entries) {
      const merged = mergedOf.get(entry);
      if (merged === null) continue;
      if (merged) {
        shared.push(merged);
        // Its section note, from the first app's, beside the shared ones.
        const note =
          merged.section && node.appHeadings?.[entry.source.group]?.sectionNotes?.[merged.section];
        if (note && merged.section) {
          node.sectionNotes ??= {};
          node.sectionNotes[merged.section] ??= note;
        }
      } else if (!entry.source.heading) shared.push(entry.row);
      else {
        own.push({ ...entry.row, app: entry.source.group });
        heldApps.add(entry.source.group);
      }
    }
    built.set(node, { rows: [...shared, ...own], heldApps });
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

  const categoryAlias = new Map<string, string>();
  const out: SettingsCategory[] = [];
  for (let node: Node | null = head; node; node = node.next) {
    const layout = built.get(node);
    const id = ids.get(node)!;
    if (!layout) continue;
    const parent = parentOf(node);
    const nested = parent !== undefined && built.has(parent);
    for (const alias of node.aliases) if (!categoryAlias.has(alias)) categoryAlias.set(alias, id);
    // A parent left empty: its old ids go to its first sub-category shown.
    if (parent && !nested) {
      for (const alias of parent.aliases) {
        if (!categoryAlias.has(alias)) categoryAlias.set(alias, id);
      }
    }
    const label = nested
      ? node.path.at(-1)!
      : node.path.length > 1
        ? shortLabel(node.path.join(' › '), orphans)
        : node.path[0]!;
    const icon = nested ? node.nestedIcon : (node.topIcon ?? parent?.topIcon);
    const appHeadings = node.appHeadings
      ? Object.fromEntries(
          Object.entries(node.appHeadings).filter(([app]) => layout.heldApps.has(app)),
        )
      : undefined;
    out.push({
      id,
      label,
      group,
      ...(nested ? { parent: ids.get(parent)! } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(node.sectionNotes ? { sectionNotes: node.sectionNotes } : {}),
      ...(node.collapsed ? { collapsedSections: [...node.collapsed] } : {}),
      ...(appHeadings && Object.keys(appHeadings).length > 0 ? { appHeadings } : {}),
      aliases: [...new Set(node.aliases)].filter((alias) => alias !== id),
      rows: layout.rows,
    });
  }

  // 4. What pointed at an old id (a link, a readout line, a nested row's switch) points at the merged one.
  if (rowAlias.size === 0 && categoryAlias.size === 0) return out;
  const row = (key: string) => rowAlias.get(key) ?? key;
  const category = (id: string) => categoryAlias.get(id) ?? id;
  return out.map((c) => ({
    ...c,
    rows: c.rows.map((r) => remapRow(r, row, category)),
  }));
}

function remapRow(
  row: SettingsRow,
  rowKey: (key: string) => string,
  categoryId: (id: string) => string,
): SettingsRow {
  const parent = row.parent !== undefined ? rowKey(row.parent) : undefined;
  const withParent = parent !== row.parent ? { ...row, parent } : row;
  switch (withParent.kind) {
    case 'link': {
      const target = categoryId(withParent.target);
      return target === withParent.target ? withParent : { ...withParent, target };
    }
    case 'presetSummary':
      return {
        ...withParent,
        lines: withParent.lines.map((line) => ({
          ...line,
          rowKey: rowKey(line.rowKey),
          categoryId: categoryId(line.categoryId),
        })),
      };
    default:
      return withParent;
  }
}
