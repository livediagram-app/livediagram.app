import type { PaletteTileDef } from './palette-tile-defs';

// The category flyout's arrangement (docs/specs/007-editor/toolbar-layout.md "The category bar"): which modes show
// the bar, whether it has room to name its categories, how each one's tiles are laid out in its flyout, the short line under its name, and
// the names of its groups. Pure, so the rules are testable without rendering the strip.

import type { EditorMode } from '@livediagram/document';

/** The modes whose strip is a category bar: Diagram and Workshop (Draw's strip is its pens). */
export const CATEGORY_BAR_MODES: ReadonlySet<EditorMode> = new Set(['diagram', 'workshop']);

// The bar names every category in one word, so a name never wraps or crowds its neighbours: a layout's longer
// name gives way to its short one here (the flyout's header uses the same, so the two never disagree).
const BAR_LABELS: Readonly<Record<string, string>> = {
  write: 'Write',
  'my-shapes': 'Library',
};

export function barLabel(categoryId: string, label: string): string {
  return BAR_LABELS[categoryId] ?? label;
}

/** How a flyout lays its tiles out: a grid of pictures where the glyph IS the answer (a square explains a square),
 *  or cards with a one-line blurb where it is not (a Sankey's glyph does not explain a Sankey). The same rule as the
 *  category bodies' (docs/specs/010-palette/palette-top-level-categories.md "Rows, not tiles"). */
type FlyoutLayout = 'grid' | 'cards';

// The grid categories and their columns: Popular's twelve as three even rows of four, Shapes five to a row.
const GRID_COLUMNS: Readonly<Record<string, number>> = { popular: 4, shapes: 5 };

export function flyoutLayout(categoryId: string): FlyoutLayout {
  return categoryId in GRID_COLUMNS ? 'grid' : 'cards';
}

/** A grid category's columns. */
export function flyoutColumns(categoryId: string): number {
  return GRID_COLUMNS[categoryId] ?? 5;
}

// Categories shown as one block whatever their dividers: Popular's picks come from every category, so its strip
// dividers would split twelve tiles into groups of one and three.
const UNGROUPED: ReadonlySet<string> = new Set(['popular']);

/** A card category's columns: one for a short list (Media's two), so its flyout is narrow; two otherwise. */
export const SHORT_CARD_LIST = 3;
export function flyoutCardColumns(tileCount: number): 1 | 2 {
  return tileCount <= SHORT_CARD_LIST ? 1 : 2;
}

// The line under a flyout's name: what the category is for, short enough for one line at 26rem. A category not
// listed falls back to its own description.
const TAGLINES: Readonly<Record<string, string>> = {
  popular: 'The tiles a diagram is most often built from.',
  shapes: 'The basics, the flowchart vocabulary, BPMN and more.',
  'my-shapes': 'Saved shapes, yours and your teams’, in every app.',
  write: 'Words on the canvas: text, notes and comments.',
  draw: 'Sketch, outline and connect by hand.',
  build: 'Structures that grow as you type.',
  diagrams: 'Structures that grow as you type, and the C4 model.',
  layout: 'Lanes, frames and the parts that label a diagram.',
  concepts: 'Structures that grow as you type, and ideas laid out as one element.',
  technology: 'Cloud and infrastructure marks for architecture.',
  media: 'Pictures and people.',
  data: 'Charts and meters that read at a glance.',
  'collab-ask': 'Put a question to the room.',
  'collab-tools': 'Run the session: timers, reveals and picks.',
  'collab-record': 'Keep what happened: comments, actions, decisions.',
  'collab-react': 'Celebrate on the canvas.',
  'collab-mode': 'Buttons that switch how everyone points.',
  'collab-navigate': 'Take everyone somewhere on the board.',
  logo: 'The tools a logo is made with.',
  components: 'Ready-made blocks that follow the theme.',
};

// Where a mode fills a category differently enough that its default line would mislead.
const MODE_TAGLINES: Readonly<Partial<Record<EditorMode, Readonly<Record<string, string>>>>> = {
  workshop: {
    shapes: 'The basics, the flowchart vocabulary and more.',
    write: 'Words, notes, tables and checklists.',
  },
};

export function flyoutTagline(categoryId: string, fallback: string, mode?: EditorMode): string {
  return (mode && MODE_TAGLINES[mode]?.[categoryId]) ?? TAGLINES[categoryId] ?? fallback;
}

// A group's name, by the tile that starts it: a category splits into groups where a tile ends one (`dividerAfter`,
// the strip's fixed dividers), and the same tile starts the same kind of group whichever mode's layout it is in.
// A category shows its groups only when every one is named; otherwise it is one block, so a layout whose dividers
// fall elsewhere (Workshop's Write) never shows half its groups headed and half bare.
const GROUP_NAMES: Readonly<Record<string, string>> = {
  'shapes:square': 'Basics',
  'shapes:cylinder': 'Flowchart',
  'shapes:cloud': 'More Shapes',
  'bpmn:start-event': 'BPMN',
  'tools:page': 'Text',
  'tools:text': 'Text',
  'tools:sticky': 'Notes',
  'tools:pencil': 'Pens',
  // Logo's Draw (palette-layouts PAGES_LOGO): the Pen first, then each person's markers as a group.
  'logo:pen': 'Pens',
  'draw:marker-main': 'Markers',
  'tools:polygon': 'Outlines',
  'tools:arrow': 'Connectors',
  'tools:mind-node': 'Diagrams',
  'diagrams:c4-person': 'C4 Model',
  'concepts:layer-stack': 'Layers',
  'concepts:funnel': 'Process',
  'concepts:cycle': 'Relationships',
  'tools:lane': 'Containers',
  'tools:diagram-key': 'Parts',
  'collab:comment-pin': 'Comments',
  'tools:table': 'Tables',
  'tools:stack': 'Layout',
  'components:hero': 'Layout',
  'tools:code-block': 'Code and Lists',
  'components:card': 'Page Blocks',
  // Page Blocks where Elements holds the Card and the Badge (a tab with a wireframe page).
  'components:step': 'Page Blocks',
  'tools:image': 'Pictures',
  'media:embed-youtube': 'Embeds',
  'tools:avatar': 'People',
  'data:pie': 'Charts',
  'data:progress-bar': 'Meters',
};

// The optional notation groups, by the tile that starts them (toolbar-layout.md "Optional groups"): a group a
// specialist wants and everyone else scrolls past, so it shows as a header row, closed until opened, remembered
// in this browser under the key `optionalGroupKey` names, and opening one reports `UI`/`Opened`/its telemetry type.
// Search finds their tiles whether open or not.
const OPTIONAL_GROUPS: Readonly<Record<string, { slug: string; telemetry: string }>> = {
  'shapes:cylinder': { slug: 'flowchart', telemetry: 'FlowchartGroup' },
  'shapes:cloud': { slug: 'more-shapes', telemetry: 'MoreShapesGroup' },
  'bpmn:start-event': { slug: 'bpmn', telemetry: 'BpmnGroup' },
};

/** The browser-storage key that remembers whether an optional group is open. */
export function optionalGroupKey(slug: string): string {
  return `livediagram:v2:palette-group-open:${slug}`;
}

/** What an optional group carries: where its open state is kept, and what opening it reports. */
export type OptionalGroup = { storageKey: string; telemetryType: string };

export type FlyoutGroup = {
  id: string;
  title: string | null;
  tiles: PaletteTileDef[];
  // Set for an optional group, closed until opened.
  optional: OptionalGroup | null;
};

function optionalOf(firstTileId: string): OptionalGroup | null {
  const group = OPTIONAL_GROUPS[firstTileId];
  return group
    ? { storageKey: optionalGroupKey(group.slug), telemetryType: group.telemetry }
    : null;
}

/** The category's tiles split into its named groups, in order; one untitled group when they are not all named. */
export function flyoutGroups(categoryId: string, tiles: readonly PaletteTileDef[]): FlyoutGroup[] {
  const runs: PaletteTileDef[][] = [[]];
  tiles.forEach((tile, i) => {
    runs.at(-1)!.push(tile);
    if (tile.dividerAfter && i < tiles.length - 1 && !UNGROUPED.has(categoryId)) runs.push([]);
  });
  const groups = runs.filter((run) => run.length > 0);
  const named = groups.length > 1 && groups.every((run) => GROUP_NAMES[run[0]!.id]);
  if (!named) {
    return tiles.length > 0
      ? [{ id: tiles[0]!.id, title: null, tiles: [...tiles], optional: null }]
      : [];
  }
  return groups.map((run) => ({
    id: run[0]!.id,
    title: GROUP_NAMES[run[0]!.id]!,
    tiles: run,
    optional: optionalOf(run[0]!.id),
  }));
}
