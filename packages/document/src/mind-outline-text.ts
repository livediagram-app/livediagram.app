// A mind map as an indented outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the map
// written out (the root on the first line, every other node a `- ` bullet two spaces deeper than
// its parent), and an outline read back forgivingly, so a list pasted from elsewhere works:
// bullets, numbered items, plain lines and headings, with inline Markdown stripped. Pure text.
import type { Element, ElementId } from './index';
import type { MindFlow } from './mind-flow';
import { mindNodesInOrder } from './mind-layout';

/** One line of an outline and the lines nested under it. */
export type MindOutlineNode = { text: string; children: MindOutlineNode[] };

// Spaces a tab counts as, and the indentation one level deeper is written with.
const OUTLINE_INDENT = 2;

/** A node's text as an outline line: its lines joined by a space, trimmed. Saves compare text so. */
export const mindOutlineLine = (text: string | undefined) =>
  (text ?? '').replace(/\s*\n\s*/g, ' ').trim();

/** The map rooted at `rootId` as an outline, siblings in the order the layout reads them. */
export function mindOutlineText(elements: Element[], rootId: ElementId, flow: MindFlow): string {
  return mindNodesInOrder(elements, rootId, flow)
    .map(({ node, depth }) =>
      depth === 0
        ? mindOutlineLine(node.label)
        : `${' '.repeat(OUTLINE_INDENT * (depth - 1))}- ${mindOutlineLine(node.label)}`,
    )
    .join('\n');
}

// Inline Markdown a pasted line may carry: emphasis, code, links (their text kept), task boxes.
function cleanInline(text: string): string {
  return text
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .trim();
}

type Line = { level: number; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const ITEM = /^(?:[-*+]|\d+[.)])\s+(.*)$/;

/**
 * An outline read into a tree: the first non-blank line is the root, whatever marks it. Headings
 * nest by their `#` count; bullets, numbered items and unmarked lines nest by indentation, one
 * level below the heading they sit under. A line can never be more than one level deeper than the
 * line above, and a second line at the root's level is the root's child. Null with no lines.
 */
export function parseMindOutline(text: string): MindOutlineNode | null {
  const lines: Line[] = [];
  let rootHashes = 0;
  // The heading the current bullets sit under, and the bullets' indentation ladder under it.
  let headingLevel = 0;
  let ladder: { indent: number; level: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const expanded = raw.replace(/\t/g, ' '.repeat(OUTLINE_INDENT));
    const indent = expanded.length - expanded.trimStart().length;
    const body = expanded.trim();
    const heading = HEADING.exec(body);
    const item = heading ? null : ITEM.exec(body);
    const content = cleanInline(heading ? heading[2]! : item ? item[1]! : body);
    if (!content) continue;
    if (lines.length === 0) {
      // The root: a heading root sets the scale the other headings are read against.
      if (heading) rootHashes = heading[1]!.length;
      else ladder = [{ indent, level: 0 }];
      lines.push({ level: 0, text: content });
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
    const above = lines[lines.length - 1]!.level;
    lines.push({ level: Math.max(1, Math.min(level, above + 1)), text: content });
  }
  if (lines.length === 0) return null;
  const root: MindOutlineNode = { text: lines[0]!.text, children: [] };
  const path: MindOutlineNode[] = [root];
  for (const line of lines.slice(1)) {
    const node: MindOutlineNode = { text: line.text, children: [] };
    path.length = line.level;
    path[line.level - 1]!.children.push(node);
    path.push(node);
  }
  return root;
}
