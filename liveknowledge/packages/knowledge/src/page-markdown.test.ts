import { describe, expect, it } from 'vitest';
import {
  appendTableRows,
  cutMarkdown,
  isBareTableRows,
  markdownHeadings,
  markdownSection,
  replacePassage,
} from './page-markdown';

const PAGE = [
  '# Deploys',
  '',
  'Deploys go out on Tuesdays.',
  '',
  '## When **we** deploy',
  '',
  'After the standup.',
  '',
  '```sh',
  '# not a heading',
  '```',
  '',
  '### Fridays',
  '',
  'Never on a Friday.',
  '',
  '## Rollbacks ##',
  '',
  'One command.',
].join('\n');

describe('markdownHeadings', () => {
  it('lists headings with their level, leaving out lines inside a code fence', () => {
    expect(markdownHeadings(PAGE).map((h) => `${h.level} ${h.text}`)).toEqual([
      '1 Deploys',
      '2 When **we** deploy',
      '3 Fridays',
      '2 Rollbacks',
    ]);
  });
});

describe('markdownSection', () => {
  it('answers a heading’s section through to the next heading of its level or above', () => {
    const section = markdownSection(PAGE, 'when we deploy')!;
    expect(section.startsWith('## When **we** deploy')).toBe(true);
    expect(section).toContain('Never on a Friday.');
    expect(section).not.toContain('One command.');
  });

  it('takes the heading with its marks, and runs to the end for the last one', () => {
    expect(markdownSection(PAGE, '## Rollbacks')).toBe('## Rollbacks ##\n\nOne command.');
  });

  it('answers undefined for a heading the page lacks, or an empty one', () => {
    expect(markdownSection(PAGE, 'Hotfixes')).toBeUndefined();
    expect(markdownSection(PAGE, '##')).toBeUndefined();
  });
});

describe('cutMarkdown', () => {
  it('keeps a page that fits whole', () => {
    expect(cutMarkdown('Short.', 100)).toEqual({ markdown: 'Short.', leftOut: 0 });
  });

  it('cuts at the last paragraph break that fits and counts what was left out', () => {
    const cut = cutMarkdown(PAGE, 60);
    expect(cut.markdown).toBe('# Deploys\n\nDeploys go out on Tuesdays.');
    expect(cut.leftOut).toBe(PAGE.length - cut.markdown.length);
  });

  it('cuts mid paragraph when the first paragraph alone is too long', () => {
    expect(cutMarkdown('abcdefghij', 4)).toEqual({ markdown: 'abcd', leftOut: 6 });
  });
});

describe('replacePassage', () => {
  it('replaces the one place a passage sits', () => {
    const out = replacePassage(PAGE, 'Deploys go out on Tuesdays.', ' Deploys go out on Mondays. ');
    expect(out).toEqual({ markdown: PAGE.replace('Tuesdays', 'Mondays') });
  });

  it('finds a passage whose spacing and line breaks differ', () => {
    const out = replacePassage('One two\nthree (four).', 'two   three (four)', 'five');
    expect(out).toEqual({ markdown: 'One five.' });
  });

  it('refuses a passage the page does not hold, an empty one, and one it holds twice', () => {
    expect(replacePassage(PAGE, 'Deploys go out on Mondays.', 'x')).toEqual({
      refusal: 'passage_not_found',
    });
    expect(replacePassage(PAGE, '  ', 'x')).toEqual({ refusal: 'passage_not_found' });
    expect(replacePassage('a b a', 'a', 'x')).toEqual({ refusal: 'passage_ambiguous' });
    expect(replacePassage('a  b a\nb', 'a b', 'x')).toEqual({ refusal: 'passage_ambiguous' });
  });
});

describe('appendTableRows', () => {
  const page = [
    'When a ticket needs more:',
    '',
    '| Problem | Escalate to |',
    '| --- | --- |',
    '| A bug | Engineering |',
    '',
    'Tell the customer.',
  ].join('\n');

  it('adds bare rows under the last row of the last table', () => {
    expect(appendTableRows(page, '| A security report | Security |')).toBe(
      page.replace(
        '| A bug | Engineering |',
        '| A bug | Engineering |\n| A security report | Security |',
      ),
    );
  });

  it('leaves anything else to an ordinary append', () => {
    expect(appendTableRows(page, 'A new paragraph.')).toBeNull();
    expect(appendTableRows(page, '| A | B |\n| --- | --- |\n| 1 | 2 |')).toBeNull();
    expect(appendTableRows('No table here.', '| A | B |')).toBeNull();
    expect(appendTableRows('```\n| a | b |\n| --- | --- |\n```', '| c | d |')).toBeNull();
    expect(isBareTableRows('| a | b |\n\n| c | d |')).toBe(true);
  });
});
