// Replace (docs/specs/007-editor/find-and-replace.md "Replace"; blueprint "Replacing"): matches swapped for new
// words, written back where each text lives, the formatting kept. Pure: one tab in, one tab out, so a Replace All is
// a single edit (one undo step) whatever it touches. Held matches (a role or a lock) are passed over.
import {
  normaliseRuns,
  normalizeRuns,
  runsPlainText,
  type ArticleBlock,
  type ArticleFlow,
  type Element,
  type Tab,
  type TextRun,
} from '@livedocuments/document';
import type { FindMatch } from './find-matches';
import type { FindTarget } from './find-targets';

type Range = readonly [number, number];

/** Runs with each range of their joined text swapped for `by`, which takes the formatting of the run the range
 *  starts in. `ranges` are sorted, never overlapping and inside the text. One pass over the runs. The caller
 *  normalises (empty runs dropped, neighbours of one format merged). */
export function replaceInRuns<R extends { text: string }>(
  runs: readonly R[],
  ranges: readonly Range[],
  by: string,
): R[] {
  const out: R[] = [];
  let r = 0;
  let pos = 0;
  for (const run of runs) {
    const end = pos + run.text.length;
    let text = '';
    let at = pos;
    while (r < ranges.length && ranges[r]![0] < end) {
      const [s, e] = ranges[r]!;
      if (s >= at) {
        text += run.text.slice(at - pos, s - pos);
        // The new words land where the range starts, in this run's formatting.
        text += by;
      }
      if (e > end) {
        // The range runs on into the next runs: their text up to its end goes.
        at = end;
        break;
      }
      at = e;
      r += 1;
    }
    if (at < end) text += run.text.slice(at - pos);
    out.push({ ...run, text });
    pos = end;
  }
  return out;
}

/** A plain string with each range swapped for `by`. */
export function replaceInString(text: string, ranges: readonly Range[], by: string): string {
  let out = '';
  let at = 0;
  for (const [s, e] of ranges) {
    out += text.slice(at, s) + by;
    at = e;
  }
  return out + text.slice(at);
}

function replaceInBlock(block: ArticleBlock, ranges: readonly Range[], by: string): ArticleBlock {
  if (block.type === 'paragraph' || block.type === 'list')
    return { ...block, runs: normaliseRuns(replaceInRuns(block.runs, ranges, by)) };
  if (block.type === 'code') return { ...block, text: replaceInString(block.text, ranges, by) };
  return block;
}

type Bag = Record<string, unknown>;

function replaceInElement(
  el: Element,
  target: FindTarget,
  ranges: readonly Range[],
  by: string,
): Element {
  const ref = target.ref;
  const bag = el as unknown as Bag;
  if (ref.kind === 'field') {
    const next: Bag = { ...bag, [ref.field]: replaceInString(target.text, ranges, by) };
    // A rich label stays its runs: the words change in them, each keeping its format, and the label is their text.
    if (ref.field === 'label' && Array.isArray(bag.richText)) {
      const runs = bag.richText as TextRun[];
      if (runsPlainText(runs) === target.text) {
        const rich = normalizeRuns(replaceInRuns(runs, ranges, by));
        next.richText = rich;
        next.label = runsPlainText(rich);
      }
    }
    return next as unknown as Element;
  }
  if (ref.kind === 'cell') {
    const cells = (bag.cells as string[][]).map((row, r) =>
      r === ref.r
        ? row.map((cell, c) => (c === ref.c ? replaceInString(cell, ranges, by) : cell))
        : row,
    );
    return { ...bag, cells } as unknown as Element;
  }
  if (ref.kind === 'item') {
    const items = (bag.checklistItems as { text: string }[]).map((item, i) =>
      i === ref.index ? { ...item, text: replaceInString(item.text, ranges, by) } : item,
    );
    return { ...bag, checklistItems: items } as unknown as Element;
  }
  return el;
}

export type ReplaceOutcome = { tab: Tab; count: number; held: number };

/** The tab with `matches` (of `targets`, found on this tab) swapped for `by`, held ones left as they are. `refit` is
 *  given every changed element (a text box that sizes to its words fits its new ones). The same tab when nothing
 *  changed. */
export function replaceInTab(
  tab: Tab,
  targets: readonly FindTarget[],
  matches: readonly FindMatch[],
  by: string,
  refit: (el: Element) => Element = (el) => el,
): ReplaceOutcome {
  // The ranges of each replaceable text, in order (matches arrive in order, never overlapping).
  const byTarget = new Map<number, [number, number][]>();
  let held = 0;
  for (const m of matches) {
    if (targets[m.target]!.held !== null) {
      held += 1;
      continue;
    }
    let list = byTarget.get(m.target);
    if (!list) byTarget.set(m.target, (list = []));
    list.push([m.start, m.end]);
  }
  if (byTarget.size === 0) return { tab, count: 0, held };
  let count = 0;
  const blockEdits = new Map<string, Map<string, readonly Range[]>>();
  const elementEdits = new Map<string, { target: FindTarget; ranges: readonly Range[] }[]>();
  for (const [t, ranges] of byTarget) {
    const target = targets[t]!;
    count += ranges.length;
    const ref = target.ref;
    if (ref.kind === 'block') {
      let flow = blockEdits.get(ref.flow);
      if (!flow) blockEdits.set(ref.flow, (flow = new Map<string, readonly Range[]>()));
      flow.set(ref.blockId, ranges);
    } else {
      let list = elementEdits.get(ref.id);
      if (!list) elementEdits.set(ref.id, (list = []));
      list.push({ target, ranges });
    }
  }
  const elements = elementEdits.size
    ? tab.elements.map((el) => {
        const edits = elementEdits.get(el.id);
        if (!edits) return el;
        let next = el;
        for (const { target, ranges } of edits) next = replaceInElement(next, target, ranges, by);
        return refit(next);
      })
    : tab.elements;
  let articles = tab.articles;
  if (blockEdits.size && articles) {
    const nextArticles: Record<string, ArticleFlow> = { ...articles };
    for (const [flow, edits] of blockEdits) {
      const doc = nextArticles[flow];
      if (!doc) continue;
      nextArticles[flow] = {
        ...doc,
        blocks: doc.blocks.map((b) => {
          const ranges = edits.get(b.id);
          return ranges ? replaceInBlock(b, ranges, by) : b;
        }),
      };
    }
    articles = nextArticles;
  }
  return { tab: { ...tab, elements, ...(articles ? { articles } : {}) }, count, held };
}
