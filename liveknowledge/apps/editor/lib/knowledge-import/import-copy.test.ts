// What the review step says about a plan (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The
// review step").

import { describe, expect, it } from 'vitest';
import { ISSUE_EXAMPLES, blockedCopy, issueGroups, pagesLabel, picturesLabel } from './import-copy';
import { planOf, plannedPage } from './test-plan';

describe('blockedCopy', () => {
  it('says why an archive cannot be imported', () => {
    expect(blockedCopy({ reason: 'archive-too-large', limitBytes: 200 * 1024 * 1024 })).toEqual({
      title: 'This Archive Is Too Large',
      detail: expect.stringContaining('up to 200 MB'),
    });
    const many = blockedCopy({ reason: 'too-many-pages', found: 812, room: 488 });
    expect(many.title).toBe('Too Many Pages');
    expect(many.detail).toContain('It holds 812 pages, and there is room for 488.');
    expect(blockedCopy({ reason: 'too-many-pages', found: 1, room: 0 }).detail).toContain(
      'It holds 1 page, and this Knowledgebase is full.',
    );
  });
});

describe('issueGroups', () => {
  it('groups warnings and skipped files by kind, with the first few by name and the rest counted', () => {
    const pages = Array.from({ length: 8 }, (_, i) =>
      plannedPage(`p${i + 1}`, {
        warnings: [{ kind: 'missing-picture', detail: `img/${i}.png` }],
      }),
    );
    pages[0]!.warnings.push({ kind: 'unsafe-link', detail: 'javascript:alert(1)' });
    const groups = issueGroups(
      planOf(pages, {
        skipped: [
          { path: 'big.md', reason: 'page-too-large', detail: '' },
          { path: 'img/huge.png', reason: 'picture-too-large', detail: '' },
        ],
        attachments: 2,
        ignoredFiles: 1,
      }),
    );
    expect(groups.map((g) => g.title)).toEqual([
      '8 Pictures Not Found',
      '1 Link Removed',
      '1 Page Over 5 MB',
      '2 Attachments Named',
      '1 File Not Used',
    ]);
    expect(groups[0]!.examples).toHaveLength(ISSUE_EXAMPLES);
    expect(groups[0]!.examples[0]).toBe('Page p1: img/0.png');
    expect(groups[0]!.more).toBe(3);
    expect(groups[2]!.examples).toEqual(['big.md']);
  });

  it('answers nothing for a clean plan', () => {
    expect(issueGroups(planOf([plannedPage('p1')]))).toEqual([]);
  });
});

describe('labels', () => {
  it('count in Title Case, one or many', () => {
    expect(pagesLabel(1)).toBe('1 Page');
    expect(pagesLabel(1320)).toBe('1,320 Pages');
    expect(picturesLabel(1)).toBe('1 Picture');
    expect(picturesLabel(2)).toBe('2 Pictures');
  });
});
