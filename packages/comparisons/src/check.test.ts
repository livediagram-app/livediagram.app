import { describe, expect, it } from 'vitest';
import { comparisonProblems } from './check';
import { alternative, comparisons } from './test/fixture';

describe('comparisonProblems', () => {
  it('finds none in a sound list', () => {
    expect(comparisonProblems(comparisons())).toEqual([]);
  });

  it('finds an empty list, a bad origin and a missing date', () => {
    const problems = comparisonProblems(
      comparisons({
        alternatives: [],
        siteUrl: 'https://testapp.example/',
        updated: new Date('x'),
      }),
    );
    expect(problems).toContain('comparisons: none listed');
    expect(problems).toContain('comparisons: siteUrl https://testapp.example/ is not an origin');
    expect(problems).toContain('comparisons: no review date');
  });

  it('finds a duplicated, unsafe or undrawn slug', () => {
    const problems = comparisonProblems(
      comparisons({
        alternatives: [
          alternative('miro', 'Miro'),
          alternative('miro', 'Miro again'),
          alternative('Big_Tool', 'Big Tool'),
          alternative('no-such-tool', 'Nobody'),
        ],
      }),
    );
    expect(problems).toContain('miro: slug is listed twice');
    expect(problems).toContain('Big_Tool: slug is not lowercase words joined by hyphens');
    expect(problems).toContain('no-such-tool: no look in COMPETITOR_LOOK');
  });

  it('finds a description that will not fit a search result, or is too thin', () => {
    const long = { ...alternative('miro', 'Miro'), description: 'x'.repeat(161) };
    const thin = { ...alternative('trello', 'Trello'), description: 'Short.' };
    const problems = comparisonProblems(comparisons({ alternatives: [long, thin] }));
    expect(problems).toContain('miro: description is 161 characters');
    expect(problems).toContain('trello: description is 6 characters');
  });

  it('finds a one-sided page, an empty cell, a long chip and an unanswered question', () => {
    const alt = {
      ...alternative('miro', 'Miro'),
      themBest: [],
      rows: [{ label: 'Price', us: 'Free', them: '' }],
      highlights: ['A chip far too long for one line', 'b', 'c'] as [string, string, string],
      faqs: [{ q: 'Why?', a: '' }],
    };
    const problems = comparisonProblems(comparisons({ alternatives: [alt] }));
    expect(problems).toEqual([
      'miro: highlight "A chip far too long for one line" is not 1 to 24 characters',
      'miro: row "Price" is missing a cell',
      'miro: no reasons to pick them',
      'miro: FAQ "Why?" is unanswered',
    ]);
  });
});
