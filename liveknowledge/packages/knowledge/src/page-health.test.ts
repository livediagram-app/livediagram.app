import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { code, divider, para, runsPara, table, bullet } from './__fixtures__/writing';
import {
  HEALTH_FACTORS,
  averageHealth,
  healthFactsOf,
  healthLabel,
  healthWire,
  likelierRight,
  lowHealthPages,
  pageHealth,
  wordBand,
  type PageHealthFacts,
  type PageHealthRow,
} from './page-health';
import { pageHeadingCount, pageWords } from './page-shape';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21, 12);

// A page with every point: verified 10 days into a 90-day period (no: freshly), owned, medium length with headings,
// linked, nothing open, read this week.
const healthy = (over: Partial<PageHealthFacts> = {}): PageHealthFacts => ({
  state: 'verified',
  verifiedAt: NOW,
  reviewAt: NOW + 90 * DAY,
  reviewDays: 90,
  owned: true,
  band: 'medium',
  headings: 2,
  brokenLinks: 0,
  backlinks: 1,
  openConflicts: 0,
  openThreads: 0,
  suggestions: 0,
  pendingApproval: false,
  reads: 3,
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
  ...over,
});

const factor = (facts: PageHealthFacts, name: (typeof HEALTH_FACTORS)[number]) =>
  pageHealth(facts, NOW).factors.find((f) => f.factor === name)!;

describe('the Health Score', () => {
  it('gives every point to a page with nothing to fix, and says so', () => {
    const health = pageHealth(healthy(), NOW);
    expect(health).toMatchObject({ score: 100, label: 'healthy', reason: 'Every check passes' });
    expect(health.factors.map((f) => f.factor)).toEqual([...HEALTH_FACTORS]);
    expect(health.factors.reduce((sum, f) => sum + f.max, 0)).toBe(100);
    expect(health.factors.every((f) => f.raise === undefined && f.fix === undefined)).toBe(true);
  });

  it('the factors always add up to the score', () => {
    const facts = healthy({
      state: 'verified',
      verifiedAt: NOW - 33 * DAY,
      reviewAt: NOW + 57 * DAY,
      updatedAt: NOW - 200 * DAY,
      band: 'short',
      openThreads: 1,
    });
    const health = pageHealth(facts, NOW);
    expect(health.factors.reduce((sum, f) => sum + f.points, 0)).toBe(health.score);
    expect(health.factors.every((f) => Number.isInteger(f.points))).toBe(true);
  });

  describe('verification', () => {
    it('a page never verified has none of its 30, and Verify raises it', () => {
      const facts = healthy({
        state: 'never-verified',
        verifiedAt: undefined,
        reviewAt: undefined,
      });
      expect(factor(facts, 'verification')).toEqual({
        factor: 'verification',
        points: 0,
        max: 30,
        raise: 'Verify this page: +30',
        gain: 30,
        fix: 'verify',
      });
      expect(pageHealth(facts, NOW).reason).toBe('Never verified');
    });

    it('a page whose review is due keeps 10 and says how long ago', () => {
      const due = (ago: number) =>
        healthy({
          state: 'review-due',
          verifiedAt: NOW - (90 + ago) * DAY,
          reviewAt: NOW - ago * DAY,
        });
      expect(factor(due(40), 'verification')).toMatchObject({
        points: 10,
        raise: 'Verify again: +20',
      });
      expect(pageHealth(due(40), NOW).reason).toBe('Review due 40 days ago');
      expect(pageHealth(due(1), NOW).reason).toBe('Review due 1 day ago');
      expect(pageHealth(due(0), NOW).reason).toBe('Review due today');
      expect(pageHealth(healthy({ state: 'review-due', reviewAt: undefined }), NOW).reason).toBe(
        'Review due',
      );
    });
  });

  describe('freshness', () => {
    it('counts the share of the Review Period left', () => {
      const at = (left: number) =>
        factor(
          healthy({ verifiedAt: NOW - (90 - left) * DAY, reviewAt: NOW + left * DAY }),
          'freshness',
        );
      expect(at(90).points).toBe(20);
      expect(at(45)).toMatchObject({ points: 15, raise: 'Verify again: +5', fix: 'verify' });
      // Rounded: 10 * 4 / 90 = 0.44.
      expect(at(4).points).toBe(10);
      expect(
        pageHealth(healthy({ verifiedAt: NOW - 50 * DAY, reviewAt: NOW + 40 * DAY }), NOW).reason,
      ).toBe('Review due in 40 days');
    });

    it('a verified page with no review date keeps the review share whole', () => {
      expect(factor(healthy({ reviewAt: undefined }), 'freshness').points).toBe(20);
    });

    it('runs down evenly from 90 days untouched to none at 455', () => {
      const touched = (days: number) =>
        factor(
          healthy({
            state: 'verified',
            reviewAt: undefined,
            verifiedAt: NOW - days * DAY,
            updatedAt: NOW - days * DAY,
          }),
          'freshness',
        );
      expect(touched(90).points).toBe(20);
      expect(touched(272).points).toBe(15);
      expect(touched(455).points).toBe(10);
      expect(touched(900).points).toBe(10);
    });

    it('takes the later of the last edit and the last Verify', () => {
      const facts = healthy({
        reviewAt: undefined,
        verifiedAt: NOW - 2 * DAY,
        updatedAt: NOW - 800 * DAY,
      });
      expect(factor(facts, 'freshness').points).toBe(20);
    });

    it('says how long since a page was touched when that is what it lost', () => {
      const facts = healthy({
        state: 'never-verified',
        verifiedAt: undefined,
        reviewAt: undefined,
        updatedAt: NOW - 425 * DAY,
      });
      expect(factor(facts, 'freshness')).toMatchObject({
        points: 1,
        raise: 'Verify this page: +19',
      });
      const owned = {
        ...facts,
        state: 'verified' as const,
        verifiedAt: NOW - 425 * DAY,
        reviewAt: undefined,
      };
      expect(pageHealth(owned, NOW).reason).toBe('Not touched in 14 months');
      const month = { ...owned, verifiedAt: NOW - 150 * DAY, updatedAt: NOW - 150 * DAY };
      expect(pageHealth(month, NOW).reason).toBe('Not touched in 5 months');
    });

    it('a page never verified, with nothing kept of its edits, guesses nothing: the touched 10', () => {
      const facts = healthy({
        state: 'never-verified',
        verifiedAt: undefined,
        reviewAt: undefined,
        updatedAt: undefined,
      });
      expect(factor(facts, 'freshness')).toMatchObject({
        points: 10,
        raise: 'Verify this page: +10',
      });
      // Verification lost more, so it is the reason; with it full, freshness's own words show.
      expect(pageHealth(facts, NOW).reason).toBe('Never verified');
    });

    it('a due page, touched lately, says it is not fresh because it is not verified', () => {
      const facts = healthy({ state: 'review-due', reviewAt: undefined, verifiedAt: NOW - DAY });
      const health = pageHealth({ ...facts, owned: true }, NOW);
      expect(health.factors[1]).toMatchObject({ points: 10 });
    });
  });

  it('owner: 10 with one, none without, and Set an Owner raises it', () => {
    expect(factor(healthy(), 'owner').points).toBe(10);
    expect(factor(healthy({ owned: false }), 'owner')).toMatchObject({
      points: 0,
      raise: 'Set an owner: +10',
      fix: 'owner',
    });
    expect(pageHealth(healthy({ owned: false }), NOW).reason).toBe('No owner');
  });

  describe('length and structure', () => {
    it('counts words in bands', () => {
      expect([0, 1, 19, 20, 49, 50, 299, 300, 2500, 2501].map(wordBand)).toEqual([
        'empty',
        'few',
        'few',
        'short',
        'short',
        'brief',
        'brief',
        'medium',
        'medium',
        'long',
      ]);
    });

    it('a short page loses points, a page of 50 words or more none', () => {
      const lengthOf = (band: PageHealthFacts['band']) => factor(healthy({ band }), 'length');
      expect(lengthOf('empty')).toMatchObject({ points: 0, raise: 'Write at least 50 words: +10' });
      expect(lengthOf('few').points).toBe(3);
      expect(lengthOf('short').points).toBe(6);
      expect(lengthOf('brief').points).toBe(10);
      expect(lengthOf('long').points).toBe(10);
      expect(pageHealth(healthy({ band: 'empty' }), NOW).reason).toBe('Empty page');
      expect(pageHealth(healthy({ band: 'few' }), NOW).reason).toBe('Under 20 words');
      expect(pageHealth(healthy({ band: 'short' }), NOW).reason).toBe('Under 50 words');
    });

    it('a longer page with no heading loses structure; a short one needs none', () => {
      expect(factor(healthy({ band: 'brief', headings: 0 }), 'structure').points).toBe(10);
      expect(factor(healthy({ band: 'medium', headings: 0 }), 'structure')).toMatchObject({
        points: 5,
        raise: 'Add a heading: +5',
        fix: 'heading',
      });
      expect(factor(healthy({ band: 'long', headings: 0 }), 'structure').points).toBe(0);
      expect(factor(healthy({ band: 'long', headings: 1 }), 'structure').points).toBe(10);
      expect(pageHealth(healthy({ band: 'long', headings: 0 }), NOW).reason).toBe(
        'No headings in a long page',
      );
      expect(pageHealth(healthy({ band: 'medium', headings: 0 }), NOW).reason).toBe('No headings');
    });
  });

  describe('links', () => {
    it('each broken link takes 2 of 4; a backlink adds the fifth', () => {
      expect(factor(healthy({ brokenLinks: 1 }), 'links')).toMatchObject({
        points: 3,
        raise: 'Fix 1 broken link: +2',
      });
      expect(factor(healthy({ brokenLinks: 2 }), 'links')).toMatchObject({
        points: 1,
        raise: 'Fix 2 broken links: +4',
      });
      expect(factor(healthy({ brokenLinks: 5, backlinks: 0 }), 'links').points).toBe(0);
      expect(factor(healthy({ backlinks: 0 }), 'links')).toMatchObject({
        points: 4,
        raise: 'Link to it from another page: +1',
      });
      // Not known (Offline, or before Page Health is read): the point is kept.
      expect(factor(healthy({ backlinks: undefined }), 'links').points).toBe(5);
      expect(pageHealth(healthy({ brokenLinks: 2 }), NOW).reason).toBe('2 broken links');
      expect(pageHealth(healthy({ backlinks: 0 }), NOW).reason).toBe('No page links here');
    });
  });

  describe('open issues', () => {
    it('a conflict costs 5, approval 2, comments 1 each to 3, suggestions 1 each to 2', () => {
      const of = (over: Partial<PageHealthFacts>) => factor(healthy(over), 'issues');
      expect(of({ openConflicts: 1 })).toMatchObject({
        points: 5,
        raise: 'Resolve the conflict: +5',
      });
      expect(of({ openConflicts: 3 })).toMatchObject({
        points: 0,
        raise: 'Resolve the conflicts: +10',
      });
      expect(of({ pendingApproval: true })).toMatchObject({
        points: 8,
        raise: 'Approve or reject it: +2',
      });
      expect(of({ openThreads: 5 })).toMatchObject({ points: 7, raise: 'Resolve 5 comments: +3' });
      expect(of({ openThreads: 1 }).raise).toBe('Resolve 1 comment: +1');
      expect(of({ suggestions: 4 })).toMatchObject({
        points: 8,
        raise: 'Accept or dismiss 4 suggested edits: +2',
      });
      expect(
        of({ openConflicts: undefined, openThreads: undefined, suggestions: undefined }).points,
      ).toBe(10);
      expect(pageHealth(healthy({ openConflicts: 2 }), NOW).reason).toBe('2 open conflicts');
      expect(pageHealth(healthy({ pendingApproval: true }), NOW).reason).toBe('Pending approval');
      expect(pageHealth(healthy({ openThreads: 3 }), NOW).reason).toBe('3 open comments');
      expect(pageHealth(healthy({ suggestions: 2 }), NOW).reason).toBe('2 suggested edits waiting');
    });
  });

  describe('use', () => {
    it('a page read this week keeps its 5; one nobody read loses them', () => {
      expect(factor(healthy({ reads: 0 }), 'use')).toMatchObject({
        points: 0,
        raise: 'Point readers to it: +5',
      });
      expect(pageHealth(healthy({ reads: 0 }), NOW).reason).toBe('Not read this week');
      expect(factor(healthy({ reads: undefined }), 'use').points).toBe(5);
    });

    it('never marks down a page in its first week for having no reads', () => {
      expect(factor(healthy({ reads: 0, createdAt: NOW - 6 * DAY }), 'use').points).toBe(5);
      expect(factor(healthy({ reads: 0, createdAt: NOW - 7 * DAY }), 'use').points).toBe(0);
      expect(factor(healthy({ reads: 0, createdAt: undefined }), 'use').points).toBe(0);
    });
  });

  it('the reason is the factor that lost the most, the first on a tie', () => {
    // Owner (10) and length empty (10) tie: owner comes first.
    expect(pageHealth(healthy({ owned: false, band: 'empty' }), NOW).reason).toBe('No owner');
  });

  it('the worst a page scores: an empty page needs no headings', () => {
    const worst = pageHealth(
      {
        state: 'never-verified',
        reviewDays: 90,
        owned: false,
        band: 'empty',
        headings: 0,
        brokenLinks: 9,
        backlinks: 0,
        openConflicts: 9,
        openThreads: 9,
        suggestions: 9,
        pendingApproval: true,
        reads: 0,
        updatedAt: NOW - 1000 * DAY,
      },
      NOW,
    );
    expect(worst.score).toBe(10);
    expect(worst.factors.find((f) => f.factor === 'structure')!.points).toBe(10);
    expect(worst.label).toBe('needs-work');
  });

  it('labels: Healthy from 75, Fair from 45, Needs Work under', () => {
    expect([100, 75, 74, 45, 44, 0].map(healthLabel)).toEqual([
      'healthy',
      'healthy',
      'fair',
      'fair',
      'needs-work',
      'needs-work',
    ]);
  });

  it('on the wire, each factor keeps its points, its maximum and what would raise it', () => {
    const wire = healthWire(pageHealth(healthy({ owned: false }), NOW));
    expect(wire.score).toBe(90);
    expect(wire.factors[2]).toEqual({
      factor: 'owner',
      points: 0,
      max: 10,
      raise: 'Set an owner: +10',
    });
    expect(wire.factors[0]).toEqual({ factor: 'verification', points: 30, max: 30 });
  });

  it('takes a 100,000-word page in constant time: the words arrive as a band', () => {
    const blocks = Array.from({ length: 2000 }, (_, at) =>
      para(
        Array.from({ length: 50 }, (_w, n) => `word${at}${n}`).join(' '),
        at % 100 === 0 ? 'h2' : undefined,
      ),
    );
    pageHealth(healthy(), NOW);
    const spent = cpuMsOf(() => {
      const words = pageWords(blocks);
      const headings = pageHeadingCount(blocks);
      expect(words).toBe(100_000);
      pageHealth(healthy({ band: wordBand(words), headings }), NOW);
    });
    expect(spent).toBeLessThan(cpuBudgetMs(50));
  });
});

// Owner 2026-11-21: "if I set no review period, / never, then don't show the verification stuff, and don't include
// it in the health scorings".
describe('under a Review Period of Never', () => {
  const never = (over: Partial<PageHealthFacts> = {}): PageHealthFacts =>
    healthy({ reviewAt: undefined, reviewDays: undefined, ...over });

  it('leaves Verification out and re-weights the rest to 100', () => {
    const health = pageHealth(never(), NOW);
    expect(health.score).toBe(100);
    expect(health.factors.map((f) => [f.factor, f.max])).toEqual([
      ['freshness', 15],
      ['owner', 15],
      ['length', 15],
      ['structure', 15],
      ['links', 10],
      ['issues', 20],
      ['use', 10],
    ]);
  });

  it('never marks a page down, or names a fix, for not being verified', () => {
    const health = pageHealth(
      never({ state: 'never-verified', verifiedAt: undefined, updatedAt: NOW - DAY }),
      NOW,
    );
    expect(health).toMatchObject({ score: 100, reason: 'Every check passes' });
    expect(health.factors.some((f) => f.fix === 'verify')).toBe(false);
    expect(JSON.stringify(health)).not.toMatch(/verif/i);
  });

  it('counts freshness from the last edit alone, scaled to 15', () => {
    const old = pageHealth(never({ verifiedAt: NOW, updatedAt: NOW - 425 * DAY }), NOW);
    expect(old.factors[0]).toEqual({
      factor: 'freshness',
      points: 2,
      max: 15,
      raise: 'Bring it up to date: +13',
      gain: 13,
    });
    expect(old.reason).toBe('Not edited in 14 months');
    // Nothing kept of its edits: nothing is guessed.
    expect(pageHealth(never({ updatedAt: undefined }), NOW).factors[0]!.points).toBe(15);
  });

  it('scales each factor and its gain, the factors adding up to the score', () => {
    const health = pageHealth(never({ owned: false, brokenLinks: 1, openThreads: 1 }), NOW);
    const of = (name: string) => health.factors.find((f) => f.factor === name)!;
    expect(of('owner')).toMatchObject({ points: 0, max: 15, raise: 'Set an owner: +15' });
    expect(of('links')).toMatchObject({ points: 6, max: 10, raise: 'Fix 1 broken link: +4' });
    expect(of('issues')).toMatchObject({ points: 18, max: 20, raise: 'Resolve 1 comment: +2' });
    expect(health.score).toBe(health.factors.reduce((sum, f) => sum + f.points, 0));
    expect(health.reason).toBe('No owner');
  });

  it('the api’s facts follow it', () => {
    const facts = healthFactsOf(
      {
        tab: 't',
        title: 'T',
        verifiedAt: null,
        owned: 1,
        words: 400,
        chars: 0,
        headings: 1,
        brokenLinks: 0,
        backlinks: 1,
        openThreads: 0,
        pendingApproval: 0,
        openConflicts: 0,
        suggestions: 0,
        reads: 1,
        createdAt: null,
        updatedAt: NOW,
      },
      'never',
      NOW,
    );
    expect(pageHealth(facts, NOW)).toMatchObject({ score: 100, label: 'healthy' });
  });
});

describe('the facts the api reads', () => {
  const row = (over: Partial<PageHealthRow> = {}): PageHealthRow => ({
    tab: 't1',
    title: 'Deploys',
    verifiedAt: NOW - 10 * DAY,
    owned: 1,
    words: 400,
    chars: 2400,
    headings: 2,
    brokenLinks: 0,
    backlinks: 1,
    openThreads: 0,
    pendingApproval: 0,
    openConflicts: 0,
    suggestions: 0,
    reads: 2,
    createdAt: NOW - 40 * DAY,
    updatedAt: NOW - 10 * DAY,
    ...over,
  });

  it('works the state out under the Review Period', () => {
    expect(healthFactsOf(row(), 90, NOW)).toMatchObject({
      state: 'verified',
      reviewAt: NOW + 80 * DAY,
      reviewDays: 90,
      owned: true,
      band: 'medium',
    });
    expect(healthFactsOf(row(), 'never', NOW)).toMatchObject({
      state: 'verified',
      reviewAt: undefined,
    });
    expect(healthFactsOf(row({ verifiedAt: NOW - 100 * DAY }), 90, NOW).state).toBe('review-due');
    expect(healthFactsOf(row({ verifiedAt: null }), 90, NOW)).toMatchObject({
      state: 'never-verified',
      verifiedAt: undefined,
      reviewAt: undefined,
    });
    expect(healthFactsOf(row({ pendingApproval: 1, owned: 0 }), 90, NOW)).toMatchObject({
      pendingApproval: true,
      owned: false,
    });
  });

  it('a page the backfill has not reached reads its words from its characters and as having a heading', () => {
    const facts = healthFactsOf(
      row({
        words: null,
        headings: null,
        owned: null,
        chars: 100,
        createdAt: null,
        updatedAt: null,
      }),
      90,
      NOW,
    );
    expect(facts).toMatchObject({ band: 'few', headings: 1, owned: false });
    expect(facts.createdAt).toBeUndefined();
    expect(healthFactsOf(row({ words: null, chars: null }), 90, NOW).band).toBe('empty');
  });
});

describe('across the knowledgebase', () => {
  const page = (tab: string, score: number, reads = 0, order = 0) => ({
    tab,
    title: tab,
    score,
    reads,
    order,
  });

  it('lists the 5 lowest under the Healthy line, a tie the most read first, then tree order', () => {
    const pages = [
      page('a', 90),
      page('b', 40, 1, 1),
      page('c', 40, 5, 2),
      page('d', 10, 0, 3),
      page('e', 74, 0, 4),
      page('f', 60, 0, 5),
      page('g', 60, 0, 0),
      page('h', 75),
    ];
    expect(lowHealthPages(pages).map((p) => p.tab)).toEqual(['d', 'c', 'b', 'g', 'f']);
    expect(lowHealthPages(pages, 10).map((p) => p.tab)).toEqual(['d', 'c', 'b', 'g', 'f', 'e']);
    expect(lowHealthPages([page('a', 100)])).toEqual([]);
  });

  it('averages to a whole number, none for no pages', () => {
    expect(averageHealth([100, 41, 40])).toBe(60);
    expect(averageHealth([])).toBeUndefined();
  });

  it('suggests the side 10 or more higher as the likelier right', () => {
    expect(likelierRight(86, 41)).toBe('a');
    expect(likelierRight(41, 51)).toBe('b');
    expect(likelierRight(50, 59)).toBeUndefined();
    expect(likelierRight(undefined, 50)).toBeUndefined();
    expect(likelierRight(50, undefined)).toBeUndefined();
  });
});

describe('the page’s shape', () => {
  it('counts the words reading time counts: text, lists, tables and code, nothing in a divider', () => {
    const blocks = [
      para('Release notes', 'title'),
      para('Tag the build', 'h2'),
      bullet('one two'),
      code('npm run deploy'),
      table([[[{ text: 'a b' }], [{ text: 'c' }]]]),
      divider(),
      para(''),
    ];
    expect(pageWords(blocks)).toBe(13);
  });

  it('counts the headings On This Page lists: levels one to three with text', () => {
    const blocks = [
      para('Title', 'title'),
      para('One', 'h1'),
      para('Two', 'h2'),
      para('Three', 'h3'),
      para('   ', 'h2'),
      para('Quote', 'quote'),
      runsPara([{ text: 'body' }]),
      bullet('x'),
    ];
    expect(pageHeadingCount(blocks)).toBe(3);
  });
});
