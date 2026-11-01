// The `components` view (docs/specs/024-agents/design-views.md "The views", blueprint VW71): the design's component
// library, one line per main (its id, name, frame, archived flag and size), then its elements indented, each with
// the id an instance's `componentOverrides` is keyed by and the fields it takes. A budget hides the element lines of
// the largest mains first, then whole mains from the end, and says so in one closing line.
import type { ComponentsView, Elision, ViewDoor } from '@livedesign/api-schema';
import {
  componentOverrideTargets,
  kindWordOf,
  type DesignComponent,
  type Element,
} from '@livedesign/design';
import { estimateTokens, type ViewResult } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { contentSummaryOf } from './content-summary';
import { textField } from './fields';
import { ELLIPSIS, jsonString, plural } from './text';

type ComponentsOptions = { budget?: number; door?: ViewDoor };
type Design = { id: string; name: string };
type ElementJson = ComponentsView['components'][number]['elements'][number];

// An id as printed: bare when it is a plain word, else a JSON string, so an override key copies out exactly.
const BARE_ID = /^[A-Za-z0-9_-]+$/;
const idText = (id: string) => (BARE_ID.test(id) ? id : JSON.stringify(id));

function elementJson(el: Element, takes: ReadonlyMap<string, string[]>): ElementJson {
  return {
    id: el.id,
    kind: kindWordOf(el),
    label: textField(el, 'label'),
    summary: contentSummaryOf(el),
    // Every element of a main takes at least one field (a stroke or a text colour), so each has its entry.
    takes: takes.get(el.id)!,
  };
}

function elementLine(e: ElementJson): string {
  const parts = [
    e.kind,
    idText(e.id),
    ...(e.label === null ? [] : [jsonString(e.label, LABEL_CUT_CHARS)]),
    ...(e.summary === null ? [] : [e.summary]),
    `takes=${e.takes.join(',')}`,
  ];
  return `  ${parts.join(' ')}`;
}

function mainLine(c: DesignComponent, hidden: boolean): string {
  const frame = `${Math.round(c.width)}x${Math.round(c.height)}`;
  const count = plural(c.elements.length, 'element', 'elements');
  return `component ${idText(c.id)} ${jsonString(c.name, LABEL_CUT_CHARS)} ${frame}${c.archived ? ' archived' : ''} · ${count}${hidden && c.elements.length ? ' (hidden)' : ''}`;
}

// What to read for the whole library, in the door's syntax.
function commandFor(door: ViewDoor, budget: number): string {
  return door === 'mcp'
    ? `read_design ${JSON.stringify({ view: 'components', budget })}`
    : `component ls --budget ${budget}`;
}

type Entry = { main: DesignComponent; elements: ElementJson[] };

function entriesOf(components: readonly DesignComponent[]): Entry[] {
  return components.map((main) => {
    const takes = new Map(componentOverrideTargets(main).map((t) => [t.elementId, t.fields]));
    return { main, elements: main.elements.map((el) => elementJson(el, takes)) };
  });
}

// The text for a fit: `collapsed` mains print no element lines, only the first `kept` mains print at all.
function compose(
  header: string,
  entries: readonly Entry[],
  collapsed: ReadonlySet<number>,
  kept: number,
): string[] {
  const lines = [header];
  entries.slice(0, kept).forEach((entry, i) => {
    lines.push(mainLine(entry.main, collapsed.has(i)));
    if (!collapsed.has(i)) for (const e of entry.elements) lines.push(elementLine(e));
  });
  return lines;
}

function elisionOf(
  entries: readonly Entry[],
  collapsed: ReadonlySet<number>,
  kept: number,
  door: ViewDoor,
  fullTokens: number,
): Elision {
  const hiddenElements = entries.reduce(
    (n, e, i) => n + (i < kept && collapsed.has(i) ? e.elements.length : 0),
    0,
  );
  const hiddenMains = entries.length - kept;
  const omitted = [
    ...(hiddenElements
      ? [{ noun: hiddenElements === 1 ? 'element' : 'elements', count: hiddenElements }]
      : []),
    ...(hiddenMains
      ? [{ noun: hiddenMains === 1 ? 'component' : 'components', count: hiddenMains }]
      : []),
  ];
  if (omitted.length === 0) return null;
  const args = { view: 'components', budget: fullTokens };
  return {
    dropped: [],
    collapsed: [],
    omitted,
    arguments: args,
    command: commandFor(door, fullTokens),
  };
}

const elisionText = (elision: NonNullable<Elision>) =>
  `${ELLIPSIS} ${elision.omitted.map((o) => `${o.count} ${o.noun} hidden`).join('; ')}: ${elision.command}`;

export function componentsView(
  design: Design,
  components: readonly DesignComponent[],
  options: ComponentsOptions = {},
): ViewResult<ComponentsView> {
  const door = options.door ?? 'cli';
  const entries = entriesOf(components);
  const archived = components.filter((c) => c.archived).length;
  const header = `doc ${design.id} ${jsonString(design.name)} · ${plural(components.length, 'component', 'components')}${archived ? `, ${archived} archived` : ''}`;
  // Each main's lengths, newlines included, so a fit is measured in O(1) a step: linear in the library overall.
  const sizes = entries.map((e) => ({
    open: mainLine(e.main, false).length + 1,
    shut: mainLine(e.main, true).length + 1,
    elements: e.elements.reduce((n, el) => n + elementLine(el).length + 1, 0),
  }));
  const fullLength = sizes.reduce((n, z) => n + z.open + z.elements, header.length);
  const fullTokens = estimateTokens(fullLength);
  const collapsed = new Set<number>();
  let kept = entries.length;
  let length = fullLength;
  const over = () => {
    if (options.budget === undefined) return false;
    const elision = elisionOf(entries, collapsed, kept, door, fullTokens);
    const closing = elision === null ? 0 : elisionText(elision).length + 1;
    return estimateTokens(length + closing) > options.budget;
  };
  let state = 'full';
  if (over()) {
    state = 'elements-hidden';
    // The largest mains first (the earlier on a tie).
    const largest = entries
      .map((e, i) => ({ i, n: e.elements.length }))
      .sort((a, b) => b.n - a.n || a.i - b.i);
    for (const { i } of largest) {
      collapsed.add(i);
      length += sizes[i]!.shut - sizes[i]!.open - sizes[i]!.elements;
      if (!over()) break;
    }
    while (over() && kept > 0) {
      state = 'lines-dropped';
      kept -= 1;
      length -= sizes[kept]!.shut;
    }
  }
  const elision = elisionOf(entries, collapsed, kept, door, fullTokens);
  const lines = compose(header, entries, collapsed, kept);
  if (elision !== null) lines.push(elisionText(elision));
  return {
    text: lines.join('\n'),
    fit: { estimate: fullTokens, state },
    json: {
      design: { id: design.id, name: design.name },
      components: entries.slice(0, kept).map((e, i) => ({
        id: e.main.id,
        name: e.main.name,
        width: e.main.width,
        height: e.main.height,
        archived: e.main.archived === true,
        elementCount: e.elements.length,
        elements: collapsed.has(i) ? [] : e.elements,
        collapsed: collapsed.has(i) ? e.elements.length : 0,
      })),
      elision,
    },
  };
}
