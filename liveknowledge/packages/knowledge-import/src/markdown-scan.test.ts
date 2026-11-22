import { describe, expect, it } from 'vitest';
import { proseLines, rewriteMarkdown, type MarkdownToken } from './markdown-scan';

/** Every token the scan finds, each replaced by its number. */
function scan(source: string): { out: string; tokens: MarkdownToken[] } {
  const tokens: MarkdownToken[] = [];
  const out = rewriteMarkdown(source, (token) => `<${tokens.push(token)}>`);
  return { out, tokens };
}

describe('rewriteMarkdown', () => {
  it('finds links, with their titles and angle brackets taken off', () => {
    const { out, tokens } = scan('See [one](a.md), [two](<b c.md> "T") and [three](d.md \'T\').');
    expect(out).toBe('See <1>, <2> and <3>.');
    expect(tokens).toEqual([
      { kind: 'link', text: 'one', target: 'a.md' },
      { kind: 'link', text: 'two', target: 'b c.md' },
      { kind: 'link', text: 'three', target: 'd.md' },
    ]);
  });

  it('takes an address with spaces, and with parentheses one deep', () => {
    expect(scan('[a](My Page.md) [b](x_(y).md)').tokens).toEqual([
      { kind: 'link', text: 'a', target: 'My Page.md' },
      { kind: 'link', text: 'b', target: 'x_(y).md' },
    ]);
  });

  it('finds pictures, and the picture inside a link', () => {
    const { out, tokens } = scan('![Alt](p.png) [![Badge](b.svg)](page.md)');
    expect(out).toBe('<1> [<2>](page.md)');
    expect(tokens).toEqual([
      { kind: 'picture', alt: 'Alt', target: 'p.png' },
      { kind: 'picture', alt: 'Badge', target: 'b.svg' },
    ]);
  });

  it('finds [[Title]], its label, and an embedded picture', () => {
    expect(scan('[[Home]] [[ Setup | start here ]] ![[shot.png]]').tokens).toEqual([
      { kind: 'title-link', target: 'Home', label: null },
      { kind: 'title-link', target: 'Setup', label: 'start here' },
      { kind: 'picture', alt: '', target: 'shot.png' },
    ]);
  });

  it('keeps what the visitor declines exactly as written', () => {
    const source = 'A [link](a.md "T") and [[Title]].';
    expect(rewriteMarkdown(source, () => null)).toBe(source);
  });

  it('leaves code alone: fences, longer fences, and code spans', () => {
    const source = [
      '```md',
      '[in fence](a.md)',
      '~~~',
      '```',
      '~~~~',
      '[in tildes](b.md)',
      '```',
      '~~~~',
      'A `[span](c.md)` and ``[two ` ticks](d.md)`` and [real](e.md) and `unclosed [x](f.md)',
    ].join('\n');
    const { out, tokens } = scan(source);
    expect(tokens).toEqual([
      { kind: 'link', text: 'real', target: 'e.md' },
      { kind: 'link', text: 'x', target: 'f.md' },
    ]);
    expect(out.split('\n').slice(0, 8)).toEqual(source.split('\n').slice(0, 8));
  });

  it('leaves an escaped bracket and broken links as written', () => {
    for (const source of [
      '\\[not](a.md)',
      '[no address]',
      '[unclosed](a.md',
      '[deep](a((b)).md)',
      '[half](a(b.md)',
      '[[]] [[a[b]]',
      '[[unclosed',
      'a ! b [',
      'trailing \\',
    ]) {
      expect(scan(source), source).toEqual({ out: source, tokens: [] });
    }
  });

  it('reads a line of unclosed brackets once', () => {
    const source = `${'[['.repeat(20000)}${'[a]('.repeat(20000)}${'`'.repeat(3)}x${'`'.repeat(2)}`;
    expect(scan(source).out).toBe(source);
  });
});

describe('proseLines', () => {
  it('yields the lines outside fenced code', () => {
    expect([...proseLines(['a', '```', 'b', '```', 'c'])]).toEqual([
      [0, 'a'],
      [4, 'c'],
    ]);
  });
});
