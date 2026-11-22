// What the Health Score reads from the editor (docs/specs/030-knowledgebase/verification.md "Health Score", "In
// Page Health"): the saved writing's shape, as primitives a selector compares by value, so a typing commit that
// crosses no band renders nothing; and the facts, from the page's trust and Page Health's read. Pure.
import {
  pageHeadingCount,
  pageLinkTargets,
  reviewDays,
  wordBand,
  type PageHealthFacts,
  type ReviewEvery,
  type WordBand,
} from '@liveknowledge/knowledge';
import type { ArticleBlock } from '@liveknowledge/document';
import type { PageHealthResponse } from '@liveknowledge/api-schema';
import type { PageTrust } from './page-trust';
import { pageWords } from './reading-time';

/** The saved writing's shape: its words' band, its headings, and its links to pages the knowledgebase no longer
 *  has. */
export type PageShape = { band: WordBand; headings: number; brokenLinks: number };

const EMPTY: PageShape = { band: 'empty', headings: 0, brokenLinks: 0 };

const headingsHeld = new WeakMap<readonly ArticleBlock[], number>();
const targetsHeld = new WeakMap<readonly ArticleBlock[], readonly string[]>();
const idsHeld = new WeakMap<readonly { id: string }[], ReadonlySet<string>>();

/** Kept per block list and per tab list, so a store update that changed neither reads nothing again. */
export function pageShapeOf(
  blocks: readonly ArticleBlock[] | undefined,
  tabs: readonly { id: string }[],
): PageShape {
  if (!blocks) return EMPTY;
  let headings = headingsHeld.get(blocks);
  if (headings === undefined) headingsHeld.set(blocks, (headings = pageHeadingCount(blocks)));
  let targets = targetsHeld.get(blocks);
  if (targets === undefined)
    targetsHeld.set(blocks, (targets = pageLinkTargets({ blocks: blocks as ArticleBlock[] })));
  let ids = idsHeld.get(tabs);
  if (ids === undefined) idsHeld.set(tabs, (ids = new Set(tabs.map((t) => t.id))));
  const known = ids;
  return {
    band: wordBand(pageWords(blocks)),
    headings,
    brokenLinks: targets.filter((t) => !known.has(t)).length,
  };
}

export const sameShape = (a: PageShape, b: PageShape): boolean =>
  a.band === b.band && a.headings === b.headings && a.brokenLinks === b.brokenLinks;

/** The facts for `pageHealth`. Before Page Health is read, and kept Offline, its counts are unknown: the score
 *  leaves out what it cannot see (backlinks and reads as full, open issues as none). */
export function pageHealthFacts(
  trust: PageTrust,
  every: ReviewEvery,
  shape: PageShape,
  health: PageHealthResponse | undefined,
): PageHealthFacts {
  const { fields } = trust;
  const signals = health?.signals;
  return {
    // Off (a Review Period of Never), the score leaves verification out whatever the state says: the stored one.
    state:
      trust.state !== 'off'
        ? trust.state
        : fields.verifiedAt === undefined
          ? 'never-verified'
          : 'verified',
    verifiedAt: fields.verifiedAt,
    reviewAt: trust.reviewAt,
    reviewDays: reviewDays(every),
    owned: fields.owner !== undefined,
    band: shape.band,
    headings: shape.headings,
    brokenLinks: shape.brokenLinks,
    backlinks: signals?.backlinks,
    openConflicts: signals?.openConflicts,
    openThreads: signals?.openThreads,
    suggestions: signals?.suggestions,
    pendingApproval: fields.approval?.state === 'pending',
    reads: health ? health.reads.people + health.reads.agents : undefined,
    createdAt: health?.created?.at,
    updatedAt: health?.updated?.at,
  };
}
