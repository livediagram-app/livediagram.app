// Markdown → diagram import (spec/27). Turns an arbitrary Markdown
// outline (XMind / Obsidian / hand-written notes) into a themed, editable
// node-link diagram on a new tab.
//
// Deliberately format-agnostic: we extract whatever hierarchy is present
// (headings, nested lists, prose, GFM tables) rather than pattern-matching
// one exporter. Three pure stages, each unit-tested:
//   parseMarkdown  — text → { roots, tables }
//   layoutOutline  — a node tree → laid-out boxed elements + connectors
//   buildTabFromMarkdown — compose + recolour to a theme → a Tab
//
// Dynamically imported by useTabActions so the parser stays out of the
// editor's initial bundle.

import {
  createPinnedArrow,
  createShape,
  createTable,
  normalizeTable,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type TableElement,
  type TextSize,
  type Tab,
} from '@livediagram/diagram';
import { getTheme, recolourElementsForTheme } from './themes';

// ---------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------

export type MarkdownNode = { label: string; children: MarkdownNode[] };
type MarkdownTable = { headers: string[]; rows: string[][] };
type ParsedMarkdown = { roots: MarkdownNode[]; tables: MarkdownTable[] };

// Strip inline Markdown / HTML so a node label reads as plain text.
// Order matters: images before links (both use `[]()`), emphasis after
// code so a backtick span isn't mangled by the asterisk passes.
export function cleanInline(input: string): string {
  let s = input;
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1'); // image → alt
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // link → text
  s = s.replace(/`([^`]+)`/g, '$1'); // inline code
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2'); // bold
  s = s.replace(/(\*|_)(.*?)\1/g, '$2'); // italic
  s = s.replace(/~~(.*?)~~/g, '$1'); // strikethrough
  s = s.replace(/<[^>]+>/g, ''); // raw HTML tags
  return s.replace(/\s+/g, ' ').trim();
}

// A GFM table delimiter row: cells of dashes with optional leading /
// trailing colons (alignment), pipe-separated. `|---|:--:|` etc.
function isDelimiterRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  const cells = t.replace(/^\||\|$/g, '').split('|');
  return cells.length > 0 && cells.every((c) => /^\s*:?-{1,}:?\s*$/.test(c));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => cleanInline(c.trim()));
}

export function parseMarkdown(markdown: string): ParsedMarkdown {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const root: MarkdownNode = { label: '', children: [] };
  // Nearest-ancestor stacks. Headings nest by `#` count; list items nest
  // by indentation. A new heading resets the list context (a list can't
  // span a heading boundary); so does a prose line.
  const headingStack: { level: number; node: MarkdownNode }[] = [];
  let listStack: { indent: number; node: MarkdownNode }[] = [];
  const tables: MarkdownTable[] = [];
  let inFence = false;
  let fenceMarker = '';

  const currentHeading = (): MarkdownNode =>
    headingStack.length > 0 ? headingStack[headingStack.length - 1]!.node : root;

  for (let i = 0; i < lines.length; i++) {
    // Normalise tabs to 4 spaces so indentation math is uniform.
    const line = lines[i]!.replace(/\t/g, '    ');
    const trimmed = line.trim();

    // Fenced code blocks: swallow everything until the matching fence.
    const fence = trimmed.match(/^(```|~~~)/);
    if (inFence) {
      if (fence && trimmed.startsWith(fenceMarker)) inFence = false;
      continue;
    }
    if (fence) {
      inFence = true;
      fenceMarker = fence[1]!;
      continue;
    }

    if (trimmed === '') continue; // blank — keep list context (loose lists)

    // Horizontal rule (---, ***, ___). Skip.
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) continue;

    // GFM table: a row with pipes immediately followed by a delimiter row.
    if (trimmed.includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1]!)) {
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j]!.includes('|') && lines[j]!.trim() !== '') {
        rows.push(splitTableRow(lines[j]!));
        j++;
      }
      tables.push({ headers, rows });
      i = j - 1;
      listStack = [];
      continue;
    }

    // ATX heading.
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      const label = cleanInline(heading[2]!.replace(/\s+#+\s*$/, '')); // drop closing ###
      if (!label) continue;
      while (headingStack.length > 0 && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      const parent = headingStack.length > 0 ? headingStack[headingStack.length - 1]!.node : root;
      const node: MarkdownNode = { label, children: [] };
      parent.children.push(node);
      headingStack.push({ level, node });
      listStack = [];
      continue;
    }

    // List item (-, *, +, 1., 1)). Indentation sets nesting depth.
    const list = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (list) {
      const indent = list[1]!.length;
      const label = cleanInline(list[2]!.replace(/^\[[ xX]\]\s+/, '')); // strip task checkbox
      if (!label) continue;
      while (listStack.length > 0 && listStack[listStack.length - 1]!.indent >= indent) {
        listStack.pop();
      }
      const parent =
        listStack.length > 0 ? listStack[listStack.length - 1]!.node : currentHeading();
      const node: MarkdownNode = { label, children: [] };
      parent.children.push(node);
      listStack.push({ indent, node });
      continue;
    }

    // Anything else: a prose line. Attach under the current heading so
    // content isn't dropped, and end the current list.
    const label = cleanInline(trimmed.replace(/^>\s?/, ''));
    if (!label) continue;
    currentHeading().children.push({ label, children: [] });
    listStack = [];
  }

  return { roots: root.children, tables };
}

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------

const NODE_H = 56;
const V_GAP = 26;
const COL_GAP = 90;
const MIN_W = 120;
const MAX_W = 240;
const ROW_STRIDE = NODE_H + V_GAP;
const COL_STRIDE = MAX_W + COL_GAP; // every column the same so widths can't collide
const LABEL_CAP = 120;

function nodeWidth(label: string): number {
  // Rough monospace-ish estimate; the renderer wraps, this just keeps the
  // box proportionate to its text without measuring the DOM.
  const est = label.length * 7.2 + 34;
  return Math.round(Math.max(MIN_W, Math.min(MAX_W, est)));
}

function capLabel(label: string): string {
  return label.length > LABEL_CAP ? `${label.slice(0, LABEL_CAP - 1).trimEnd()}…` : label;
}

function depthTextSize(depth: number): TextSize {
  return depth === 0 ? 'lg' : depth === 1 ? 'md' : 'sm';
}

type OutlineLayout = {
  elements: Element[];
  // Bounding box of the laid-out tree, for stacking tables beneath it.
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

// Tidy left-to-right tree. Leaves take successive rows; a parent centres
// on the span of its children. Columns are fixed-stride by depth so
// variable box widths never overlap horizontally. Parent→child links are
// curved pinned arrows (parent east → child west).
export function layoutOutline(root: MarkdownNode, originX = 0, originY = 0): OutlineLayout {
  const boxes: ShapeElement[] = [];
  const arrows: ArrowElement[] = [];
  let nextRow = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const place = (node: MarkdownNode, depth: number): { id: string; cy: number } => {
    const childResults = node.children.map((c) => place(c, depth + 1));
    let cy: number;
    if (childResults.length === 0) {
      cy = originY + nextRow * ROW_STRIDE + NODE_H / 2;
      nextRow++;
    } else {
      cy = (childResults[0]!.cy + childResults[childResults.length - 1]!.cy) / 2;
    }
    const w = nodeWidth(node.label);
    const x = originX + depth * COL_STRIDE;
    const y = cy - NODE_H / 2;
    const el: ShapeElement = {
      ...createShape('square', x, y),
      width: w,
      height: NODE_H,
      label: capLabel(node.label),
      textSize: depthTextSize(depth),
    };
    boxes.push(el);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + NODE_H > maxY) maxY = y + NODE_H;
    for (const cr of childResults) {
      arrows.push({ ...createPinnedArrow(el.id, 'e', cr.id, 'w'), arrowStyle: 'curved' });
    }
    return { id: el.id, cy };
  };

  place(root, 0);
  // Boxes first, arrows last (so connectors render over the nodes) —
  // matches the template builders' z-order.
  return {
    elements: [...boxes, ...arrows],
    bounds: { minX, minY, maxX, maxY },
  };
}

function buildTableElement(table: MarkdownTable, x: number, y: number): TableElement {
  const cols = Math.max(table.headers.length, ...table.rows.map((r) => r.length), 1);
  const fit = (row: string[]): string[] => {
    const out = row.slice(0, cols);
    while (out.length < cols) out.push('');
    return out;
  };
  const cells = [fit(table.headers), ...table.rows.map(fit)];
  const rowH = 40;
  const width = Math.min(760, Math.max(MIN_W, cols * 150));
  const height = cells.length * rowH;
  // normalizeTable guarantees a rectangular grid even if a body row was
  // ragged — the editor's single entry point for stored tables.
  return normalizeTable({
    ...createTable(x, y),
    cells,
    width,
    height,
    headerRow: true,
  });
}

// ---------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------

type MarkdownImportResult = { ok: true; tab: Tab } | { ok: false; error: string };

export function buildTabFromMarkdown(
  markdown: string,
  // `themeId` is a plain string (Tab.theme is untyped beyond string, and
  // getTheme falls back to Brand for anything it doesn't recognise) so the
  // caller can pass the active tab's theme straight through.
  opts: { tabName?: string; themeId?: string } = {},
): MarkdownImportResult {
  const tabName = (opts.tabName ?? '').trim() || 'Imported';
  const themeId = opts.themeId ?? 'brand';
  const parsed = parseMarkdown(markdown);

  if (parsed.roots.length === 0 && parsed.tables.length === 0) {
    return { ok: false, error: 'No headings, lists, or tables found in this Markdown.' };
  }

  const elements: Element[] = [];
  let treeBottom = 0;
  let treeLeft = 0;

  if (parsed.roots.length > 0) {
    // One top-level node → use it as the root. Several → wrap them under a
    // synthetic root named for the file so the result is one connected tree.
    const root: MarkdownNode =
      parsed.roots.length === 1 ? parsed.roots[0]! : { label: tabName, children: parsed.roots };
    const laid = layoutOutline(root);
    elements.push(...laid.elements);
    treeBottom = laid.bounds.maxY;
    treeLeft = laid.bounds.minX;
  }

  // Tables stacked in a column below the tree (or at the origin when the
  // document is tables-only).
  let tableY = parsed.roots.length > 0 ? treeBottom + 80 : 0;
  for (const table of parsed.tables) {
    const el = buildTableElement(table, treeLeft, tableY);
    elements.push(el);
    tableY += el.height + 40;
  }

  const theme = getTheme(themeId);
  // Graph-aware recolour: an imported outline is a tree of pinned
  // arrows, so a multi-colour theme (spec/29) tints each top-level
  // branch its own hue.
  const themed = recolourElementsForTheme(elements, theme);

  return {
    ok: true,
    tab: {
      id: crypto.randomUUID(),
      name: tabName,
      elements: themed,
      theme: themeId,
      backgroundColor: theme.backgroundColor,
      backgroundPattern: theme.backgroundPattern,
      patternColor: theme.patternColor,
      templateChosen: true,
    },
  };
}
