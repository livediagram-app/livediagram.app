import { describe, expect, it } from 'vitest';
import { notionMarkdown } from './notion-markdown';

describe('notionMarkdown', () => {
  it('turns a callout into a quote', () => {
    expect(
      notionMarkdown(
        ['Before', '<aside>', '\u{1F4A1} Remember this', '', 'And this', '</aside>', 'After'].join(
          '\n',
        ),
      ),
    ).toBe(['Before', '> \u{1F4A1} Remember this', '>', '> And this', 'After'].join('\n'));
  });

  it('turns a toggle into a heading and its content', () => {
    expect(
      notionMarkdown(
        [
          '<details>',
          '<summary>How to deploy</summary>',
          '',
          'Run the script.',
          '</details>',
          '<details><summary>One line</summary>',
          'Body',
          '</details>',
          '<details open>',
          'No summary',
          '</details>',
        ].join('\n'),
      ),
    ).toBe(
      ['### How to deploy', '', 'Run the script.', '### One line', 'Body', 'No summary'].join('\n'),
    );
  });

  it('leaves code as written', () => {
    const source = ['```html', '<aside>', '<details>', '```'].join('\n');
    expect(notionMarkdown(source)).toBe(source);
  });
});
