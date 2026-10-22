// Markdown → diagram import (docs/specs/020-import-export/markdown-import.md). Turns an arbitrary Markdown
// outline (XMind / Obsidian / hand-written notes) into a themed, editable
// node-link diagram that replaces the active tab's contents.
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
  glyphWidth,
  LABEL_FONT_PX,
  MAX_TABLE_CELLS,
  MAX_TABLE_COLS,
  MAX_TABLE_ROWS,
  normalizeTable,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type TableElement,
  type Tab,
} from '@livedesign/document';
import type { ImportOutcome } from './import-tab';
import { getTheme, recolourElementsForTheme } from './themes';

// ---------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------

export type MarkdownNode = { label: string; children: MarkdownNode[] };

// The deepest a list nests in the imported tree (docs/specs/020-import-export/markdown-import.md
// "Limits"). With six heading levels and the root above it the tree is at most 31 deep, so the
// recursive layout and recolour stay far inside the stack; a deeper item becomes a sibling of the
// deepest. 24 is beyond any outline a person writes; safe range 8 to a few hundred.
export const MAX_LIST_DEPTH = 24;

// The most nodes one import keeps: headings, list items, prose lines and tables together, in
// document order (docs/specs/020-import-export/markdown-import.md "Limits"). The rest are counted as
// left out and the Import dialog's report says how many. Provenance (measured 2026-10-10): each
// outline node lands as a box and an arrow, about 450 bytes of tab JSON with a 40-character label
// and 650 at the 120-character label cap, so 2,000 nodes of two-byte characters at the cap made a
// 1.29 MB tab (4,001 elements), inside the 1,991,808-byte tab row (MAX_TAB_BYTES) and the 10,000
// MAX_ELEMENTS_PER_TAB, and built in under 10 ms; 3,000 such nodes came within 3% of the row cap.
// Safe range 500 to 2,500; above that a long-labelled outline no longer fits one tab.
export const MAX_MARKDOWN_IMPORT_NODES = 2_000;

type MarkdownTable = { headers: string[]; rows: string[][] };
// `leftOut`: the headings, list items, prose lines and tables past MAX_MARKDOWN_IMPORT_NODES.
type ParsedMarkdown = { roots: MarkdownNode[]; tables: MarkdownTable[]; leftOut: number };

// Strip inline Markdown / HTML so a node label reads as plain text.
// Order matters: images before links (both use `[]()`), emphasis after
// code so a backtick span isn't mangled by the asterisk passes.
export function cleanInline(input: string): string {
  let s = input;
  // Each class leaves out its own opener too, so a failed match stops at the next one: a line of a
  // thousand `[` or `<` is linear, where the open classes rescanned to the line's end from each.
  s = s.replace(/!\[([^\][]*)\]\([^()]*\)/g, '$1'); // image → alt
  s = s.replace(/\[([^\][]+)\]\([^()]*\)/g, '$1'); // link → text
  s = s.replace(/`([^`]+)`/g, '$1'); // inline code
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2'); // bold
  s = s.replace(/(\*|_)(.*?)\1/g, '$2'); // italic
  s = s.replace(/~~(.*?)~~/g, '$1'); // strikethrough

  // Raw HTML tags. Repeated until the string stops changing, because one pass
  // is not a fixpoint: the scanner resumes after each match, so removing an
  // inner tag can splice the text either side of it into a fresh tag that is
  // never re-examined, and an unterminated `<script` survives untouched.
  // Each pass strictly shortens the string so this terminates; the guard caps
  // the work on adversarial input rather than trading one denial of service
  // for another.
  //
  // This is a readability pass, not the security boundary. Labels are escaped
  // where they are rendered (xmlEscape in the SVG renderer, React on the
  // canvas); nothing downstream interpolates a label as raw markup.
  for (let pass = 0; pass < 5; pass += 1) {
    const next = s.replace(/<[^<>]*>/g, '');
    if (next === s) break;
    s = next;
  }
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
  // Nodes kept so far, and those read past the cap. Once full, every later node is counted, never
  // kept, so the import stays the file's first MAX_MARKDOWN_IMPORT_NODES in document order.
  let kept = 0;
  let leftOut = 0;
  const hasRoom = (): boolean => {
    if (kept < MAX_MARKDOWN_IMPORT_NODES) {
      kept += 1;
      return true;
    }
    leftOut += 1;
    return false;
  };

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
        // Rows past what a table holds are read past, never kept (buildTableElement truncates
        // the rest to the validator's bounds).
        if (rows.length < MAX_TABLE_ROWS) rows.push(splitTableRow(lines[j]!));
        j++;
      }
      if (hasRoom()) tables.push({ headers, rows });
      i = j - 1;
      listStack = [];
      continue;
    }

    // ATX heading.
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      const label = cleanInline(heading[2]!.replace(/\s+#+\s*$/, '')); // drop closing ###
      if (!label || !hasRoom()) continue;
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
      if (!label || !hasRoom()) continue;
      while (listStack.length > 0 && listStack[listStack.length - 1]!.indent >= indent) {
        listStack.pop();
      }
      // Nesting past MAX_LIST_DEPTH continues as siblings of the deepest item: a file of
      // thousands of ever-deeper lines would otherwise recurse the layout past the stack.
      if (listStack.length >= MAX_LIST_DEPTH) listStack.pop();
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
    if (!label || !hasRoom()) continue;
    currentHeading().children.push({ label, children: [] });
    listStack = [];
  }

  return { roots: root.children, tables, leftOut };
}

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------

const NODE_H = 56;
const V_GAP = 26;
const COL_GAP = 90;
const MIN_W = 120;
const LABEL_CAP = 120;
// A box's side padding and its label's line height (as a fraction of the font), as the editor sets a label.
const PAD_X = 40;
const LINE_EM = 1.35;
// The widest a box grows before its label wraps, per depth's text size: about eighteen characters a line.
const MAX_W: Readonly<Record<'sm' | 'md' | 'lg', number>> = { sm: 240, md: 320, lg: 400 };

// A box sized to its label at its own text size (the spec's "Boxes are sized to their label"): the label's
// estimated one-line width up to the size's cap, then a line taller for each wrap. Measured at 7 px a glyph
// whatever the size, a root's 32 px "Flowchart" got a 120 px box and broke mid-word out of it.
function nodeSize(label: string, size: 'sm' | 'md' | 'lg'): { width: number; height: number } {
  const px = LABEL_FONT_PX[size];
  const maxW = MAX_W[size];
  const textW = glyphWidth(label, px);
  const width = Math.round(Math.max(MIN_W, Math.min(maxW, textW + PAD_X)));
  const lines = Math.max(1, Math.ceil(textW / (width - PAD_X)));
  // One line of even the root's text sits in the standard height; each wrap adds its line.
  const height = Math.round(NODE_H + (lines - 1) * px * LINE_EM);
  return { width, height };
}

function capLabel(label: string): string {
  return label.length > LABEL_CAP ? `${label.slice(0, LABEL_CAP - 1).trimEnd()}…` : label;
}

function depthTextSize(depth: number): 'sm' | 'md' | 'lg' {
  return depth === 0 ? 'lg' : depth === 1 ? 'md' : 'sm';
}

type OutlineLayout = {
  elements: Element[];
  // Bounding box of the laid-out tree, for stacking tables beneath it.
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

// Tidy left-to-right tree. Leaves stack down by their own heights; a parent centres
// on the span of its children (or starts at its span's top when it is the taller). Each
// depth is a column as wide as its widest box, so variable box widths never overlap
// horizontally. Parent→child links are curved pinned arrows (parent east → child west).
export function layoutOutline(root: MarkdownNode, originX = 0, originY = 0): OutlineLayout {
  const boxes: { el: ShapeElement; depth: number }[] = [];
  const arrows: ArrowElement[] = [];
  const columnW: number[] = [];
  let nextY = originY;

  const place = (node: MarkdownNode, depth: number): { id: string } => {
    const label = capLabel(node.label);
    const textSize = depthTextSize(depth);
    const { width, height } = nodeSize(label, textSize);
    const top = nextY;
    const childResults = node.children.map((c) => place(c, depth + 1));
    let y: number;
    if (childResults.length === 0) {
      y = top;
    } else {
      // The children's span: the first one's top to the last one's bottom.
      const spanBottom = nextY - V_GAP;
      y = Math.max(top, (top + spanBottom) / 2 - height / 2);
    }
    nextY = Math.max(nextY, y + height + V_GAP);
    const el: ShapeElement = {
      ...createShape('square', 0, y),
      width,
      height,
      label,
      textSize,
    };
    boxes.push({ el, depth });
    columnW[depth] = Math.max(columnW[depth] ?? 0, width);
    for (const cr of childResults) {
      arrows.push({ ...createPinnedArrow(el.id, 'e', cr.id, 'w'), arrowStyle: 'curved' });
    }
    return { id: el.id };
  };

  place(root, 0);
  // Each column starts past the widest box of every column before it.
  const columnX: number[] = [];
  for (let d = 0, x = originX; d < columnW.length; d++) {
    columnX[d] = x;
    x += columnW[d]! + COL_GAP;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const placed = boxes.map(({ el, depth }) => {
    const x = columnX[depth]!;
    if (x < minX) minX = x;
    if (el.y < minY) minY = el.y;
    if (x + el.width > maxX) maxX = x + el.width;
    if (el.y + el.height > maxY) maxY = el.y + el.height;
    return { ...el, x };
  });
  // Boxes first, arrows last (so connectors render over the nodes) —
  // matches the template builders' z-order.
  return {
    elements: [...placed, ...arrows],
    bounds: { minX, minY, maxX, maxY },
  };
}

// A table larger than validation accepts (MAX_TABLE_ROWS / _COLS / _CELLS, packages/document) is
// truncated to fit: its first columns, then as many of its first rows as the cell budget allows.
function buildTableElement(table: MarkdownTable, x: number, y: number): TableElement {
  let widest = Math.max(table.headers.length, 1);
  for (const r of table.rows) if (r.length > widest) widest = r.length;
  const cols = Math.min(widest, MAX_TABLE_COLS);
  const bodyRows = Math.min(MAX_TABLE_ROWS, Math.floor(MAX_TABLE_CELLS / cols)) - 1;
  const fit = (row: string[]): string[] => {
    const out = row.slice(0, cols);
    while (out.length < cols) out.push('');
    return out;
  };
  const cells = [fit(table.headers), ...table.rows.slice(0, bodyRows).map(fit)];
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

// `leftOut` counts what MAX_MARKDOWN_IMPORT_NODES left behind (0 when the whole file fit).
type MarkdownImportResult = { ok: true; tab: Tab; leftOut: number } | { ok: false; error: string };

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
  // arrows, so a multi-colour theme (docs/specs/011-theme/multicolour-themes.md) tints each top-level
  // branch its own hue.
  const themed = recolourElementsForTheme(elements, theme);

  return {
    ok: true,
    leftOut: parsed.leftOut,
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

// The report line for nodes past the cap.
export function markdownLeftOutMessage(leftOut: number): string {
  return `${leftOut.toLocaleString('en-GB')} headings, list items, lines and tables beyond the first ${MAX_MARKDOWN_IMPORT_NODES.toLocaleString('en-GB')} were left out.`;
}

/**
 * The Import dialog's outcome for a Markdown import: the import report when the node cap left something out, so
 * nothing is lost silently.
 */
export function markdownImportOutcome(leftOut: number): ImportOutcome {
  if (leftOut <= 0) return { status: 'done' };
  return {
    status: 'done',
    failures: [{ title: 'Markdown', message: markdownLeftOutMessage(leftOut) }],
  };
}
