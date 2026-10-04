// A mind map as an indented outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the map
// written out (the root on the first line, every other node a `- ` bullet two spaces deeper than
// its parent, a node's further lines of text lined up under its first), and an outline read back
// forgivingly, so a list pasted from elsewhere works: bullets, numbered items, plain lines and
// headings, with inline Markdown stripped. Pure text.
import type { Element, ElementId } from './index';
import type { MindFlow } from './mind-flow';
import { mindNodesInOrder } from './mind-layout';
import {
  mindMarkdownToMarks,
  mindMarksLines,
  mindMarksToMarkdown,
  mindNodeMarks,
} from './mind-outline-marks';
import { normalizeRuns, runsPlainText, trimRuns, type TextRun } from './rich-text';

/**
 * One node of an outline: its text (line breaks kept), its bold / italic / underline over that
 * text, and the nodes nested under it.
 */
export type MindOutlineNode = { text: string; marks: TextRun[]; children: MindOutlineNode[] };

// Spaces a tab counts as, and the indentation one level deeper is written with.
const OUTLINE_INDENT = 2;
// The bullet every node below the root is written with.
const BULLET = '- ';

/**
 * A node's text as the outline holds it: each line trimmed, blank lines dropped, joined by line
 * breaks. Saves compare text so.
 */
export const mindOutlineNodeText = (text: string | undefined) =>
  (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

/**
 * One node as outline text at `depth` (0 the root): its first line behind its bullet, its further
 * lines lined up under its text, its marks as Markdown emphasis.
 */
export function mindOutlineEntryText(depth: number, marks: TextRun[]): string {
  const [first = '', ...more] = mindMarksLines(marks).map(mindMarksToMarkdown);
  const lead = depth === 0 ? '' : `${' '.repeat(OUTLINE_INDENT * (depth - 1))}${BULLET}`;
  const under = ' '.repeat(lead.length);
  return [lead + first, ...more.map((l) => under + l)].join('\n');
}

/** The map rooted at `rootId` as an outline, siblings in the order the layout reads them. */
export function mindOutlineText(elements: Element[], rootId: ElementId, flow: MindFlow): string {
  return mindNodesInOrder(elements, rootId, flow)
    .map(({ node, depth }) => mindOutlineEntryText(depth, mindNodeMarks(node)))
    .join('\n');
}

/**
 * One line of an outline as it is read: a node's first line (`more` false) at its `level` (0 the
 * root), or a further line of the node above (`more` true, at that node's level).
 */
type MindOutlineRead = {
  level: number;
  text: string;
  marks: TextRun[];
  more: boolean;
};

// A heading's `#`s and a list item's marker, each followed by white space (the content is what is
// left once that space is trimmed off: no backtracking over it).
const HEADING = /^(#{1,6})(?=\s)/;
const ITEM = /^(?:[-*+]|\d{1,9}[.)])(?=\s)/;
// A marker with nothing after it yet: an empty item, never text.
const BARE_MARKER = /^(?:[-*+]|\d+[.)]|#{1,6})$/;

/**
 * Each line of an outline as it is read, or null for a line that is nothing (blank, or empty once
 * its marker and inline Markdown are gone). The first node line is the root, whatever marks it.
 * Headings nest by their `#` count; bullets, numbered items and unmarked lines nest by
 * indentation, one level below the heading they sit under. A line can never be more than one
 * level deeper than the line above, and a second line at the root's level is the root's child. An
 * unmarked line directly under the root or a marked line, lined up with that line's text, is a
 * further line of its text.
 */
function mindOutlineLines(text: string): (MindOutlineRead | null)[] {
  const out: (MindOutlineRead | null)[] = [];
  let above = -1;
  let rootHashes = 0;
  // The heading the current bullets sit under, and the bullets' indentation ladder under it.
  let headingLevel = 0;
  let ladder: { indent: number; level: number }[] = [];
  // The node a further line may continue: its level and the column its text starts at.
  let open: { level: number; column: number } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const expanded = raw.replace(/\t/g, ' '.repeat(OUTLINE_INDENT));
    const indent = expanded.length - expanded.trimStart().length;
    const body = expanded.trim();
    if (!body || BARE_MARKER.test(body)) {
      open = null;
      out.push(null);
      continue;
    }
    const heading = HEADING.exec(body);
    const item = heading ? null : ITEM.exec(body);
    const marker = heading ?? item;
    const rawContent = marker ? body.slice(marker[0].length).trimStart() : body;
    const marks = trimRuns(mindMarkdownToMarks(rawContent));
    const content = runsPlainText(marks);
    const column = indent + body.length - rawContent.length;
    if (!heading && !item && open && indent === open.column) {
      out.push(content ? { level: open.level, text: content, marks, more: true } : null);
      continue;
    }
    if (!content) {
      out.push(null);
      continue;
    }
    if (above < 0) {
      // The root: a heading root sets the scale the other headings are read against.
      if (heading) rootHashes = heading[1]!.length;
      else ladder = [{ indent, level: 0 }];
      out.push({ level: 0, text: content, marks, more: false });
      above = 0;
      open = { level: 0, column };
      continue;
    }
    let level: number;
    if (heading) {
      level = Math.max(1, heading[1]!.length - rootHashes);
      headingLevel = level;
      ladder = [];
    } else {
      while (ladder.length > 0 && ladder[ladder.length - 1]!.indent > indent) ladder.pop();
      const top = ladder[ladder.length - 1];
      if (top && top.indent === indent) {
        level = top.level;
        ladder.pop();
      } else level = top ? top.level + 1 : headingLevel + 1;
      ladder.push({ indent, level: Math.max(1, level) });
    }
    above = Math.max(1, Math.min(level, above + 1));
    out.push({ level: above, text: content, marks, more: false });
    // Only a marked line takes further lines: under a plain line, a plain line is a node.
    open = heading || item ? { level: above, column } : null;
  }
  return out;
}

/** An outline read into a tree (`mindOutlineLines`' nodes, nested). Null with no lines. */
export function parseMindOutline(text: string): MindOutlineNode | null {
  let root: MindOutlineNode | null = null;
  const path: MindOutlineNode[] = [];
  for (const line of mindOutlineLines(text)) {
    if (!line) continue;
    if (line.more) {
      const node = path[path.length - 1]!;
      node.text += `\n${line.text}`;
      node.marks = normalizeRuns([...node.marks, { text: '\n' }, ...line.marks]);
      continue;
    }
    const node: MindOutlineNode = { text: line.text, marks: line.marks, children: [] };
    if (!root) root = node;
    else {
      path.length = line.level;
      path[line.level - 1]!.children.push(node);
    }
    path.push(node);
  }
  return root;
}
