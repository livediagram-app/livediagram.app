// The writing between its stored form and the editor's (docs/specs/007-editor/article-pages.md
// "Blocks"): `ArticleBlock`s to a ProseMirror article and back, one top-level node per block, ids
// kept. Reading back reuses the previous block object wherever nothing changed, so an untouched
// block keeps its identity and the block diff (diffArticleFlow) only ever sees real changes.
import type { Mark, Node as PMNode } from 'prosemirror-model';
import {
  isArticleHex,
  isSafeArticleHref,
  normaliseRuns,
  sameArticleValue,
  type ArticleAlign,
  type ArticleBlock,
  type ArticleListKind,
  type ArticleParagraphStyle,
  type ArticleRun,
  type ArticleZoneAlign,
  type ArticleZoneAt,
  type ArticleZoneKind,
  type ArticleZoneWrap,
} from '@livediagram/document';
import { articleSchema } from './article-schema';

const S = articleSchema;

const RUN_MARKS: [keyof ArticleRun, string][] = [
  ['b', 'bold'],
  ['i', 'italic'],
  ['u', 'underline'],
  ['s', 'strike'],
  ['code', 'code'],
  ['sup', 'sup'],
  ['sub', 'sub'],
];

function marksOf(run: ArticleRun): Mark[] {
  const marks: Mark[] = [];
  if (run.href && isSafeArticleHref(run.href)) marks.push(S.marks.link!.create({ href: run.href }));
  for (const [flag, name] of RUN_MARKS) if (run[flag]) marks.push(S.marks[name]!.create());
  if (run.color && isArticleHex(run.color)) marks.push(S.marks.color!.create({ color: run.color }));
  if (run.hl && isArticleHex(run.hl)) marks.push(S.marks.highlight!.create({ color: run.hl }));
  if (run.note) marks.push(S.marks.note!.create({ id: run.note, kind: run.nk ?? 'comment' }));
  return marks;
}

function inlineOf(runs: readonly ArticleRun[]): PMNode[] {
  const out: PMNode[] = [];
  for (const run of runs) {
    const marks = marksOf(run);
    // A '\n' in a run is a line break in the block.
    run.text.split('\n').forEach((part, i) => {
      if (i > 0) out.push(S.nodes.hard_break!.create());
      if (part) out.push(S.text(part, marks));
    });
  }
  return out;
}

/** One block as its editor node. */
export function blockToNode(b: ArticleBlock): PMNode {
  switch (b.type) {
    case 'paragraph':
      return S.nodes.paragraph!.create(
        { id: b.id, style: b.style ?? 'body', align: b.align ?? 'left' },
        inlineOf(b.runs),
      );
    case 'list':
      return S.nodes.list_item!.create(
        {
          id: b.id,
          list: b.list,
          level: b.level ?? 0,
          checked: b.checked === true,
          align: b.align ?? 'left',
        },
        inlineOf(b.runs),
      );
    case 'code':
      return S.nodes.code_block!.create({ id: b.id }, b.text ? S.text(b.text) : undefined);
    case 'divider':
      return S.nodes.divider!.create({ id: b.id });
    case 'pageBreak':
      return S.nodes.page_break!.create({ id: b.id });
    case 'zone':
      return S.nodes.zone!.create({
        id: b.id,
        zone: b.zone,
        wrap: b.wrap ?? 'inline',
        align: b.align ?? 'center',
        width: b.width,
        height: b.height,
        at: b.at ?? null,
      });
  }
}

/** The writing as an editor article. */
export function blocksToDoc(blocks: readonly ArticleBlock[]): PMNode {
  return S.nodes.doc!.create(null, blocks.map(blockToNode));
}

function runsOf(node: PMNode): ArticleRun[] {
  const runs: ArticleRun[] = [];
  node.forEach((child) => {
    if (child.type === S.nodes.hard_break) {
      // A line break takes the format of the text before it, so it merges into that run (stored
      // as one run "a\nb") and reads back the same.
      const prev = runs[runs.length - 1];
      runs.push(prev ? { ...prev, text: '\n' } : { text: '\n' });
      return;
    }
    if (!child.isText || !child.text) return;
    const run: ArticleRun = { text: child.text };
    for (const mark of child.marks) {
      const name = mark.type.name;
      if (name === 'link') run.href = mark.attrs.href as string;
      else if (name === 'color') run.color = mark.attrs.color as string;
      else if (name === 'highlight') run.hl = mark.attrs.color as string;
      else if (name === 'note') {
        run.note = mark.attrs.id as string;
        if (mark.attrs.kind === 'action') run.nk = 'action';
      } else {
        const flag = RUN_MARKS.find(([, n]) => n === name)?.[0];
        if (flag) (run as Record<string, unknown>)[flag] = true;
      }
    }
    runs.push(run);
  });
  // A break between two runs of one format merges into them (normaliseRuns), as stored.
  return normaliseRuns(runs);
}

/** One editor node as its block (undefined for a node with no id yet). */
export function nodeToBlock(node: PMNode): ArticleBlock | undefined {
  const id = node.attrs.id as string;
  if (!id) return undefined;
  const align = node.attrs.align as ArticleAlign | undefined;
  const aligned = align && align !== 'left' ? { align } : {};
  switch (node.type.name) {
    case 'paragraph': {
      const style = node.attrs.style as ArticleParagraphStyle;
      return {
        id,
        type: 'paragraph',
        ...(style !== 'body' ? { style } : {}),
        ...aligned,
        runs: runsOf(node),
      };
    }
    case 'list_item': {
      const level = node.attrs.level as number;
      const list = node.attrs.list as ArticleListKind;
      return {
        id,
        type: 'list',
        list,
        ...(level > 0 ? { level } : {}),
        ...(list === 'todo' && node.attrs.checked ? { checked: true as const } : {}),
        ...aligned,
        runs: runsOf(node),
      };
    }
    case 'code_block':
      return { id, type: 'code', text: node.textContent };
    case 'divider':
      return { id, type: 'divider' };
    case 'page_break':
      return { id, type: 'pageBreak' };
    case 'zone': {
      const a = node.attrs as {
        zone: ArticleZoneKind;
        wrap: ArticleZoneWrap;
        align: ArticleZoneAlign;
        width: number;
        height: number;
        at: ArticleZoneAt | null;
      };
      return {
        id,
        type: 'zone',
        zone: a.zone,
        ...(a.wrap !== 'inline' ? { wrap: a.wrap } : {}),
        ...(a.align !== 'center' ? { align: a.align } : {}),
        width: a.width,
        height: a.height,
        ...(a.at ? { at: a.at } : {}),
      };
    }
    default:
      return undefined;
  }
}

/** The editor article as blocks, reusing `previous`'s block object wherever a block is
 *  unchanged, and `previous` itself when nothing changed at all. */
export function docToBlocks(doc: PMNode, previous: readonly ArticleBlock[] = []): ArticleBlock[] {
  const prevById = new Map(previous.map((b) => [b.id, b]));
  const out: ArticleBlock[] = [];
  doc.forEach((node) => {
    const block = nodeToBlock(node);
    if (!block) return;
    const prev = prevById.get(block.id);
    out.push(prev && sameArticleValue(prev, block) ? prev : block);
  });
  if (out.length === previous.length && out.every((b, i) => b === previous[i])) {
    return previous as ArticleBlock[];
  }
  return out;
}
