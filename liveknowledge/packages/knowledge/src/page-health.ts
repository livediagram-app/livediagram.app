// A page's Health Score (docs/specs/030-knowledgebase/verification.md "Health Score"): how far a reader, a person or
// an agent, can lean on a page, 0 to 100, from eight factors, each a whole number of points. One pure function for
// the editor's Page Health, the api's agent answers, Ask and AI Knowledge, so everyone sees the same number. Constant
// work: nothing in the facts grows it (the words arrive as a band).

import type { TrustStateName } from './trust';
import type { ReviewEvery } from '@liveknowledge/document';
import { reviewDays } from './trust';

const DAY_MS = 86_400_000;

/** At or above: Healthy. */
export const HEALTH_HEALTHY_MIN = 75;
/** At or above (and under Healthy): Fair. Under it: Needs Work. */
export const HEALTH_FAIR_MIN = 45;
/** How much higher one side of a conflict must score to be suggested as the likely right one. */
export const HEALTH_LIKELIER_MARGIN = 10;
/** The pages Knowledge Health lists as low. */
export const LOW_HEALTH_PAGES = 5;

/** Touched this recently is fresh; after it the points run down evenly over a year. */
const FRESH_DAYS = 90;
const STALE_OVER_DAYS = 365;
/** A page made this recently is never marked down for having no reads yet. */
const NEW_PAGE_DAYS = 7;

export type PageHealthLabel = 'healthy' | 'fair' | 'needs-work';
export const HEALTH_LABEL_WORDS: Record<PageHealthLabel, string> = {
  healthy: 'Healthy',
  fair: 'Fair',
  'needs-work': 'Needs Work',
};

export const HEALTH_FACTORS = [
  'verification',
  'freshness',
  'owner',
  'length',
  'structure',
  'links',
  'issues',
  'use',
] as const;
export type PageHealthFactorName = (typeof HEALTH_FACTORS)[number];
export const HEALTH_FACTOR_WORDS: Record<PageHealthFactorName, string> = {
  verification: 'Verification',
  freshness: 'Freshness',
  owner: 'Owner',
  length: 'Length',
  structure: 'Structure',
  links: 'Links',
  issues: 'Open Issues',
  use: 'Use',
};
const MAX: Record<PageHealthFactorName, number> = {
  verification: 30,
  freshness: 20,
  owner: 10,
  length: 10,
  structure: 10,
  links: 5,
  issues: 10,
  use: 5,
};

/** How long a page's writing is, in the bands the score counts (a word typed inside one changes nothing). */
export type WordBand = 'empty' | 'few' | 'short' | 'brief' | 'medium' | 'long';
export function wordBand(words: number): WordBand {
  if (words <= 0) return 'empty';
  if (words < 20) return 'few';
  if (words < 50) return 'short';
  if (words < 300) return 'brief';
  if (words <= 2500) return 'medium';
  return 'long';
}

/** A fix a press away, where the person may make it. */
// Open issues each name where they are dealt with (owner 2026-11-22: a conflict in Score Breakdown had no way to it).
export type PageHealthFix =
  'verify' | 'owner' | 'heading' | 'conflicts' | 'comments' | 'suggestions';

export type PageHealthFactor = {
  factor: PageHealthFactorName;
  points: number;
  max: number;
  /** What would raise it, with the points it gains ("Verify this page: +30"); absent at full. */
  raise?: string;
  gain?: number;
  fix?: PageHealthFix;
};

export type PageHealthScore = {
  score: number;
  label: PageHealthLabel;
  /** The factor that lost the most points, in a few words; "Every check passes" at 100. */
  reason: string;
  factors: PageHealthFactor[];
};

/** What the score reads. `backlinks` and `reads` undefined (kept Offline, or before Page Health is read) count as
 *  full; the issue counts undefined as none. */
export type PageHealthFacts = {
  state: TrustStateName;
  verifiedAt?: number | undefined;
  /** When the review is, or was, due; absent under Never. */
  reviewAt?: number | undefined;
  /** The Review Period's days; undefined under Never. */
  reviewDays?: number | undefined;
  owned: boolean;
  band: WordBand;
  headings: number;
  brokenLinks: number;
  backlinks?: number | undefined;
  openConflicts?: number | undefined;
  openThreads?: number | undefined;
  suggestions?: number | undefined;
  pendingApproval: boolean;
  /** Reads this week, by people and agents. */
  reads?: number | undefined;
  createdAt?: number | undefined;
  updatedAt?: number | undefined;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type Part = { points: number; reason?: string; raise?: string; gain?: number; fix?: PageHealthFix };

function verification(f: PageHealthFacts, now: number): Part {
  if (f.state === 'verified') return { points: 30 };
  if (f.state === 'never-verified')
    return {
      points: 0,
      reason: 'Never verified',
      raise: 'Verify this page',
      gain: 30,
      fix: 'verify',
    };
  const ago = f.reviewAt === undefined ? undefined : Math.floor((now - f.reviewAt) / DAY_MS);
  const reason =
    ago === undefined
      ? 'Review due'
      : ago <= 0
        ? 'Review due today'
        : `Review due ${plural(ago, 'day')} ago`;
  return { points: 10, reason, raise: 'Verify again', gain: 20, fix: 'verify' };
}

// Under a Review Period of Never (owner 2026-11-21: "don't include it in the health scorings"): no verification
// and no share of a period, only how lately the page was edited, out of 10 before re-weighting.
function editedLately(f: PageHealthFacts, now: number): Part {
  const days = f.updatedAt === undefined ? 0 : Math.max(0, (now - f.updatedAt) / DAY_MS);
  const points = Math.round(10 * clamp01(1 - (days - FRESH_DAYS) / STALE_OVER_DAYS));
  if (points === 10) return { points };
  return {
    points,
    reason: `Not edited in ${plural(Math.floor(days / 30), 'month')}`,
    raise: 'Bring it up to date',
    gain: 10 - points,
  };
}

function freshness(f: PageHealthFacts, now: number): Part {
  let left = 0;
  if (f.state === 'verified')
    left =
      f.reviewAt === undefined
        ? 10
        : Math.round(10 * clamp01((f.reviewAt - now) / (f.reviewDays! * DAY_MS)));
  // Touched: the later of the last edit and the last Verify. Neither kept: nothing is guessed, the full 10.
  const touched = Math.max(f.updatedAt ?? 0, f.verifiedAt ?? 0);
  const days = touched > 0 ? Math.max(0, (now - touched) / DAY_MS) : 0;
  const recent = Math.round(10 * clamp01(1 - (days - FRESH_DAYS) / STALE_OVER_DAYS));
  const points = left + recent;
  if (points === 20) return { points };
  const months = Math.floor(days / 30);
  const reason =
    recent < 10
      ? `Not touched in ${plural(months, 'month')}`
      : f.state === 'verified' && f.reviewAt !== undefined
        ? `Review due in ${plural(Math.max(0, Math.ceil((f.reviewAt - now) / DAY_MS)), 'day')}`
        : 'Not verified, so not fresh';
  return {
    points,
    reason,
    raise: f.state === 'never-verified' ? 'Verify this page' : 'Verify again',
    gain: 20 - points,
    fix: 'verify',
  };
}

function owner(f: PageHealthFacts): Part {
  return f.owned
    ? { points: 10 }
    : { points: 0, reason: 'No owner', raise: 'Set an owner', gain: 10, fix: 'owner' };
}

const LENGTH: Record<WordBand, number> = {
  empty: 0,
  few: 3,
  short: 6,
  brief: 10,
  medium: 10,
  long: 10,
};
const SHORT_WORDS: Partial<Record<WordBand, string>> = {
  empty: 'Empty page',
  few: 'Under 20 words',
  short: 'Under 50 words',
};

function length(f: PageHealthFacts): Part {
  const points = LENGTH[f.band];
  if (points === 10) return { points };
  return {
    points,
    reason: SHORT_WORDS[f.band]!,
    raise: 'Write at least 50 words',
    gain: 10 - points,
  };
}

function structure(f: PageHealthFacts): Part {
  if (f.headings > 0 || (f.band !== 'medium' && f.band !== 'long')) return { points: 10 };
  const points = f.band === 'long' ? 0 : 5;
  return {
    points,
    reason: f.band === 'long' ? 'No headings in a long page' : 'No headings',
    raise: 'Add a heading',
    gain: 10 - points,
    fix: 'heading',
  };
}

function links(f: PageHealthFacts): Part {
  const broken = Math.max(0, f.brokenLinks);
  const kept = Math.max(0, 4 - 2 * broken);
  const linked = f.backlinks === undefined || f.backlinks > 0 ? 1 : 0;
  const points = kept + linked;
  if (broken > 0)
    return {
      points,
      reason: plural(broken, 'broken link'),
      raise: `Fix ${plural(broken, 'broken link')}`,
      gain: 4 - kept,
    };
  if (linked === 0)
    return { points, reason: 'No page links here', raise: 'Link to it from another page', gain: 1 };
  return { points };
}

function issues(f: PageHealthFacts): Part {
  const conflicts = Math.max(0, f.openConflicts ?? 0);
  const threads = Math.max(0, f.openThreads ?? 0);
  const suggestions = Math.max(0, f.suggestions ?? 0);
  const lost = [
    {
      cost: 5 * conflicts,
      reason: plural(conflicts, 'open conflict'),
      raise: conflicts === 1 ? 'Resolve the conflict' : 'Resolve the conflicts',
      fix: 'conflicts' as const,
    },
    {
      cost: f.pendingApproval ? 2 : 0,
      reason: 'Pending approval',
      raise: 'Approve or reject it',
      fix: undefined,
    },
    {
      cost: Math.min(3, threads),
      reason: plural(threads, 'open comment'),
      raise: `Resolve ${plural(threads, 'comment')}`,
      fix: 'comments' as const,
    },
    {
      cost: Math.min(2, suggestions),
      reason: `${plural(suggestions, 'suggested edit')} waiting`,
      raise: `Accept or dismiss ${plural(suggestions, 'suggested edit')}`,
      fix: 'suggestions' as const,
    },
  ];
  const total = lost.reduce((sum, l) => sum + l.cost, 0);
  const points = Math.max(0, 10 - total);
  const first = lost.find((l) => l.cost > 0);
  if (!first) return { points };
  return {
    points,
    reason: first.reason,
    raise: first.raise,
    gain: Math.min(10 - points, first.cost),
    ...(first.fix ? { fix: first.fix } : {}),
  };
}

function readsFactor(f: PageHealthFacts, now: number): Part {
  if (f.reads === undefined || f.reads > 0) return { points: 5 };
  if (f.createdAt !== undefined && now - f.createdAt < NEW_PAGE_DAYS * DAY_MS) return { points: 5 };
  return { points: 0, reason: 'Not read this week', raise: 'Point readers to it', gain: 5 };
}

export const healthLabel = (score: number): PageHealthLabel =>
  score >= HEALTH_HEALTHY_MIN ? 'healthy' : score >= HEALTH_FAIR_MIN ? 'fair' : 'needs-work';

/** The score, its word, its main reason and each factor (the spec's table). */
/** What each factor is worth under a Review Period of Never: Verification is left out and the rest re-weighted
 *  to 100 (verification.md "Health Score"). Each factor's points are its own, scaled to this and rounded. */
const NEVER_MAX: Record<Exclude<PageHealthFactorName, 'verification'>, number> = {
  freshness: 15,
  owner: 15,
  length: 15,
  structure: 15,
  links: 10,
  issues: 20,
  use: 10,
};

/** The score, its word, its main reason and each factor (the spec's table). Under a Review Period of Never
 *  (`reviewDays` undefined) there is no Verification factor, Freshness counts only the last edit, and the factors
 *  are re-weighted to 100 (NEVER_MAX). */
export function pageHealth(facts: PageHealthFacts, now: number): PageHealthScore {
  const never = facts.reviewDays === undefined;
  const parts: Record<PageHealthFactorName, Part> = {
    verification: verification(facts, now),
    freshness: never ? editedLately(facts, now) : freshness(facts, now),
    owner: owner(facts),
    length: length(facts),
    structure: structure(facts),
    links: links(facts),
    issues: issues(facts),
    use: readsFactor(facts, now),
  };
  let score = 0;
  let reason = 'Every check passes';
  let most = 0;
  const counted = never ? HEALTH_FACTORS.filter((f) => f !== 'verification') : HEALTH_FACTORS;
  const factors = counted.map((factor): PageHealthFactor => {
    const raw = parts[factor];
    const rawMax = factor === 'freshness' && never ? 10 : MAX[factor];
    const max = never ? NEVER_MAX[factor as keyof typeof NEVER_MAX] : rawMax;
    const scale = (n: number) => Math.round((n * max) / rawMax);
    const points = scale(raw.points);
    const gain = raw.gain === undefined ? undefined : scale(raw.points + raw.gain) - points;
    score += points;
    if (max - points > most) {
      most = max - points;
      reason = raw.reason!;
    }
    return {
      factor,
      points,
      max,
      ...(raw.raise ? { raise: `${raw.raise}: +${gain}`, gain: gain! } : {}),
      ...(raw.fix ? { fix: raw.fix } : {}),
    };
  });
  score = Math.min(100, Math.max(0, score));
  return { score, label: healthLabel(score), reason, factors };
}

/** A score as the wire carries it to agents: each factor's points, its maximum and what would raise it. */
export type PageHealthWire = {
  score: number;
  label: PageHealthLabel;
  reason: string;
  factors: { factor: PageHealthFactorName; points: number; max: number; raise?: string }[];
};
export const healthWire = (health: PageHealthScore): PageHealthWire => ({
  score: health.score,
  label: health.label,
  reason: health.reason,
  factors: health.factors.map((f) => ({
    factor: f.factor,
    points: f.points,
    max: f.max,
    ...(f.raise ? { raise: f.raise } : {}),
  })),
});

/** One row of the api's facts read (apps/api/src/knowledge/page-health-read.ts). */
export type PageHealthRow = {
  tab: string;
  title: string;
  verifiedAt: number | null;
  owned: number | null;
  words: number | null;
  chars: number | null;
  headings: number | null;
  brokenLinks: number;
  backlinks: number;
  openThreads: number;
  pendingApproval: number;
  openConflicts: number;
  suggestions: number;
  reads: number;
  createdAt: number | null;
  updatedAt: number | null;
};

/** A row as facts, under the knowledgebase's Review Period. A page the backfill has not reached since the index
 *  kept words reads its words from its characters (about six a word) and as having a heading. */
export function healthFactsOf(
  row: PageHealthRow,
  every: ReviewEvery,
  now: number,
): PageHealthFacts {
  const days = reviewDays(every);
  const verifiedAt = row.verifiedAt ?? undefined;
  const reviewAt =
    verifiedAt === undefined || days === undefined ? undefined : verifiedAt + days * DAY_MS;
  const state: TrustStateName =
    verifiedAt === undefined
      ? 'never-verified'
      : reviewAt !== undefined && reviewAt <= now
        ? 'review-due'
        : 'verified';
  return {
    state,
    verifiedAt,
    reviewAt,
    reviewDays: days,
    owned: (row.owned ?? 0) > 0,
    band: wordBand(row.words ?? Math.round((row.chars ?? 0) / 6)),
    headings: row.headings ?? 1,
    brokenLinks: row.brokenLinks,
    backlinks: row.backlinks,
    openConflicts: row.openConflicts,
    openThreads: row.openThreads,
    suggestions: row.suggestions,
    pendingApproval: row.pendingApproval > 0,
    reads: row.reads,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

export type ScoredPage = {
  tab: string;
  title: string;
  score: number;
  reads: number;
  order: number;
};

/** The pages Knowledge Health lists as low: under the Healthy line, lowest first, then the most read, then tree
 *  order; `limit` at most. */
export function lowHealthPages<T extends ScoredPage>(
  pages: readonly T[],
  limit = LOW_HEALTH_PAGES,
): T[] {
  return pages
    .filter((p) => p.score < HEALTH_HEALTHY_MIN)
    .sort((a, b) => a.score - b.score || b.reads - a.reads || a.order - b.order)
    .slice(0, limit);
}

/** The average score, a whole number; undefined for no pages. */
export function averageHealth(scores: readonly number[]): number | undefined {
  if (scores.length === 0) return undefined;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/** The side of a conflict likelier to be right: the one HEALTH_LIKELIER_MARGIN or more higher; else undefined. */
export function likelierRight(a: number | undefined, b: number | undefined): 'a' | 'b' | undefined {
  if (a === undefined || b === undefined) return undefined;
  if (a - b >= HEALTH_LIKELIER_MARGIN) return 'a';
  if (b - a >= HEALTH_LIKELIER_MARGIN) return 'b';
  return undefined;
}
