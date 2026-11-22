// The participant writing rule (docs/specs/013-workspace/share-roles.md "What a Participant changes";
// docs/specs/007-editor/article-pages.md "Share roles"). A Participant writes in an article that is already on the
// tab: it adds, changes and removes the article's writing blocks (paragraphs, lists, code). It never changes the
// article's style, its zones, its dividers or page breaks, never adds or removes an article, and never writes in one
// whose tab or any of whose pages is locked. The server applies each of a Participant's `article` frames to the
// STORED tab through this one pure function; the editor asks the same question of its own change before it lands.

import { articlesOf, sameArticleValue, type ArticleBlock, type ArticleFlow } from './article-flow';
import { applyArticleOps, diffArticleFlow, type ArticleOp } from './article-flow-ops';
import { withArticleFlow } from './article-pages';
import type { Tab } from './index';
import { pagesOf } from './page';

// The blocks that are writing: an allow-list, so a new kind of block is an Editor's until someone decides otherwise.
const WRITING_BLOCKS: ReadonlySet<ArticleBlock['type']> = new Set(['paragraph', 'list', 'code']);

export type ParticipantArticleRefusal = 'tab-locked' | 'missing' | 'locked' | 'not-writing';

export type ParticipantArticleResult =
  // `changed` is false when the stored article already said it, so nothing needs writing or relaying.
  | { result: 'applied'; tab: Tab; changed: boolean }
  | { result: 'refused'; reason: ParticipantArticleRefusal };

function refuse(reason: ParticipantArticleRefusal): ParticipantArticleResult {
  return { result: 'refused', reason };
}

const isWriting = (block: ArticleBlock | undefined): boolean =>
  block !== undefined && WRITING_BLOCKS.has(block.type);

/** Whether one op is writing, against the article as the ops before it left it. */
function opIsWriting(flow: ArticleFlow, op: ArticleOp): boolean {
  if (op.kind === 'style') return false;
  // A table cell's text is writing; the table's shape (a put of the table) is not.
  if (op.kind === 'cell') return flow.blocks.some((b) => b.id === op.block && b.type === 'table');
  const id = op.kind === 'remove' ? op.id : op.block.id;
  const there = flow.blocks.find((b) => b.id === id);
  // A remove of a block that is not there changes nothing.
  if (op.kind === 'remove') return there === undefined || isWriting(there);
  // A put is a writing block, over nothing or over another writing block (never over a zone or a break).
  return isWriting(op.block) && (there === undefined || isWriting(there));
}

/** A Participant's writing in one article, applied to `tab`. `ops` are already parsed (parseArticleOps). */
export function applyParticipantArticleOps(
  tab: Tab,
  flow: string,
  ops: readonly ArticleOp[],
): ParticipantArticleResult {
  if (tab.locked === true) return refuse('tab-locked');
  const stored = articlesOf(tab)[flow];
  if (!stored) return refuse('missing');
  if (pagesOf(tab).some((p) => p.flow === flow && p.locked === true)) return refuse('locked');
  let next = stored;
  for (const op of ops) {
    if (!opIsWriting(next, op)) return refuse('not-writing');
    next = applyArticleOps(next, [op]);
  }
  const changed = !sameArticleValue(stored, next);
  return { result: 'applied', tab: changed ? withArticleFlow(tab, flow, next) : tab, changed };
}

/** The editor's side: whether a change to a tab's articles, `before` to `after`, is writing the room would take
 *  whole. No article added or removed, and every changed article's ops pass the rule. */
export function participantArticlesChange(before: Tab, after: Tab): boolean {
  const was = articlesOf(before);
  const now = articlesOf(after);
  const flows = new Set([...Object.keys(was), ...Object.keys(now)]);
  for (const flow of flows) {
    const a = was[flow];
    const b = now[flow];
    if (!a || !b) return false;
    if (a === b || sameArticleValue(a, b)) continue;
    const outcome = applyParticipantArticleOps(before, flow, diffArticleFlow(a, b));
    if (outcome.result === 'refused') return false;
  }
  return true;
}
