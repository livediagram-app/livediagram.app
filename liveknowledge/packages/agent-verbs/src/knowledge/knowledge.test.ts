import { describe, expect, it } from 'vitest';
import {
  jsonBody,
  knowledgePath,
  pageRefOf,
  resultTrustOf,
  treeRowLine,
  treeRowOf,
  trustFieldsOf,
  trustLine,
} from '.';

const AT = Date.UTC(2026, 9, 1);
const DUE = AT + 90 * 86_400_000;

describe('knowledgePath', () => {
  it('encodes every part, so a page may be named by its title', () => {
    expect(knowledgePath('kb')).toBe('/documents/kb');
    expect(knowledgePath('kb', 'pages', 'On call/rota', 'move')).toBe(
      '/documents/kb/pages/On%20call%2Frota/move',
    );
    expect(jsonBody('PUT', { a: 1 })).toEqual({ method: 'PUT', body: '{"a":1}' });
  });
});

describe('the trust fields', () => {
  it('names a page by its id and title', () => {
    expect(pageRefOf({ tab: 't1', title: 'Deploys' })).toEqual({ page: 't1', title: 'Deploys' });
  });

  it('carry only what a page has', () => {
    expect(trustFieldsOf({ state: 'never-verified', stale: false })).toEqual({
      verified: 'never-verified',
      stale: false,
    });
    expect(
      trustFieldsOf({
        state: 'review-due',
        verifiedAt: AT,
        verifiedBy: 'Webber',
        reviewAt: DUE,
        stale: true,
        conflictsWith: [{ tab: 'h', title: 'Holidays' }],
      }),
    ).toEqual({
      verified: 'review-due',
      verified_at: '2026-10-01T00:00:00.000Z',
      verified_by: 'Webber',
      review_due: '2026-12-30T00:00:00.000Z',
      stale: true,
      conflicts_with: [{ page: 'h', title: 'Holidays' }],
    });
    expect(
      trustFieldsOf({ state: 'verified', verifiedAt: AT, stale: false, conflictsWith: [] }),
    ).toEqual({ verified: 'verified', verified_at: '2026-10-01T00:00:00.000Z', stale: false });
  });

  it('read a search result’s state, dates and conflicts', () => {
    const result = {
      id: 'p1',
      tab: 't1',
      isTitle: false,
      title: 'Deploys',
      titleMarked: 'Deploys',
      headings: [],
      snippet: '',
      firstBlock: 'b1',
      lastBlock: 'b1',
    };
    expect(resultTrustOf({ ...result, trust: 'never-verified' })).toEqual({
      verified: 'never-verified',
      stale: false,
    });
    expect(
      resultTrustOf({
        ...result,
        trust: 'review-due',
        verifiedAt: AT,
        reviewAt: DUE,
        conflictsWith: [{ tab: 'h', title: 'Holidays' }],
      }),
    ).toMatchObject({
      verified: 'review-due',
      stale: true,
      review_due: '2026-12-30T00:00:00.000Z',
      conflicts_with: [{ page: 'h', title: 'Holidays' }],
    });
  });
});

describe('trustLine', () => {
  it('says each state in a line', () => {
    expect(trustLine({ verified: 'never-verified', stale: false })).toBe('never verified');
    expect(
      trustLine({
        verified: 'verified',
        verified_at: '2026-10-01T00:00:00.000Z',
        verified_by: 'Webber',
        review_due: '2026-12-30T00:00:00.000Z',
        stale: false,
      }),
    ).toBe('verified 2026-10-01 by Webber, review due 2026-12-30');
    expect(
      trustLine({ verified: 'verified', verified_at: '2026-10-01T00:00:00.000Z', stale: false }),
    ).toBe('verified 2026-10-01');
    expect(
      trustLine({
        verified: 'review-due',
        verified_at: '2026-10-01T00:00:00.000Z',
        review_due: '2026-12-30T00:00:00.000Z',
        stale: true,
        conflicts_with: [
          { page: 'h', title: 'Holidays' },
          { page: 'r', title: 'Rollbacks' },
        ],
      }),
    ).toBe('REVIEW DUE, last verified 2026-10-01, CONFLICTS WITH "Holidays", "Rollbacks"');
  });
});

// A connected file in the tree (links-and-embeds.md "Connected files in the sidebar"): listed with its app, never a page.
describe('a tree row', () => {
  it('reads a connected file with its app and place, and says it is not a page', () => {
    const row = treeRowOf({
      tab: 'plan',
      title: 'Launch Plan',
      kind: 'connected',
      app: 'liveplanner',
      depth: 1,
      parent: 'deploys',
      subpages: 0,
    });
    expect(row).toEqual({
      page: 'plan',
      title: 'Launch Plan',
      depth: 1,
      parent: 'deploys',
      kind: 'connected',
      app: 'liveplanner',
      subpages: 0,
    });
    expect(treeRowLine(row)).toBe('connected liveplanner file, not a page');
  });

  it('reads a page at the top level with its trust and context', () => {
    const row = treeRowOf({
      tab: 'deploys',
      title: 'Deploys',
      depth: 0,
      subpages: 2,
      context: true,
      trust: { state: 'never-verified', stale: false },
    });
    expect(row).not.toHaveProperty('parent');
    expect(row).toMatchObject({ page: 'deploys', subpages: 2, always_in_context: true });
    expect(treeRowLine(row)).toContain('always in context');
  });
});
