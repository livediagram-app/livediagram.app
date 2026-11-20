// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerBody } from './AnswerBody';

// docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows": a finished answer's Markdown is drawn
// formatted (it showed as raw characters: "**Thursdays**", "- one"), from text and elements made here.
afterEach(cleanup);

const TITLES = new Map([
  [1, 'Release Process'],
  [2, 'Hotfixes'],
]);
const draw = (text: string, onCite = vi.fn()) => {
  const view = render(<AnswerBody text={text} titles={TITLES} onCite={onCite} />);
  return { answer: view.container.querySelector('[data-ask-answer]')!, onCite };
};

describe('AnswerBody', () => {
  it('draws bold, italic, inline code, lists and a code block as what they are', () => {
    const { answer } = draw(
      [
        'We release on **Thursdays** and _never_ on a Friday. Run `pnpm release`.',
        '',
        '1. Tag the build',
        '2. Deploy',
        '',
        '- one',
        '- two',
        '',
        '```',
        'git tag v1',
        '```',
      ].join('\n'),
    );
    expect(answer.querySelector('strong')!.textContent).toBe('Thursdays');
    expect(answer.querySelector('em')!.textContent).toBe('never');
    expect(answer.querySelector('p code')!.textContent).toBe('pnpm release');
    expect([...answer.querySelectorAll('ol > li')].map((li) => li.textContent)).toEqual([
      'Tag the build',
      'Deploy',
    ]);
    expect([...answer.querySelectorAll('ul > li')].map((li) => li.textContent)).toEqual([
      'one',
      'two',
    ]);
    expect(answer.querySelector('pre code')!.textContent).toBe('git tag v1');
    // None of the marks is left as a character.
    expect(answer.textContent).not.toMatch(/\*\*|`|^- /m);
  });

  it('keeps its citation chips, each opening its passage', () => {
    const { answer, onCite } = draw('We release on **Thursdays** [1]. Hotfixes go any day [2].');
    expect(answer.textContent).toBe('We release on Thursdays1. Hotfixes go any day2.');
    fireEvent.click(screen.getByRole('button', { name: 'Source 2: Hotfixes' }));
    expect(onCite).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('makes no element from a tag the model wrote', () => {
    const { answer } = draw(
      'Look <img src=x onerror="window.pwned=1"> <script>window.pwned=1</script> <a href="javascript:1">x</a>',
    );
    expect(answer.querySelector('img, script, a, iframe, style')).toBeNull();
    expect(answer.textContent).toContain('<img src=x onerror="window.pwned=1">');
    expect((window as { pwned?: number }).pwned).toBeUndefined();
  });

  it('links to an http or https address in a new tab with no way back, and to nothing else', () => {
    const { answer } = draw(
      '[the docs](https://example.com/docs) and [a trap](javascript:alert(1)) and [mail](mailto:a@b.c)',
    );
    const links = [...answer.querySelectorAll('a')];
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('https://example.com/docs');
    expect(links[0]!.getAttribute('target')).toBe('_blank');
    expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(answer.textContent).toContain('a trap');
    expect(answer.innerHTML).not.toContain('javascript:');
  });

  it('draws nested items inside their item, and a table as a table', () => {
    const { answer } = draw(
      [
        '- Deploy',
        '  - to staging',
        '',
        '| Day | What |',
        '| --- | --- |',
        '| Thu | Release |',
      ].join('\n'),
    );
    expect(answer.querySelector('ul > li ul > li')!.textContent).toBe('to staging');
    expect([...answer.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Day', 'What']);
    expect([...answer.querySelectorAll('td')].map((td) => td.textContent)).toEqual([
      'Thu',
      'Release',
    ]);
  });
});
