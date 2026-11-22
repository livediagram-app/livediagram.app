import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { answerBlocks, safeHref, type AnswerBlock, type AnswerInline } from './answer-blocks';

// docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows": the answer's Markdown, formatted, and never
// as HTML.
const text = (inline: readonly AnswerInline[]) =>
  inline.map((part) => (part.kind === 'text' ? part.text : `{${part.number}}`)).join('');
const kinds = (blocks: readonly AnswerBlock[]) => blocks.map((block) => block.kind);
const NONE = new Set<number>();

describe('an answer’s Markdown as blocks', () => {
  it('reads paragraphs, bold, italic and inline code, where the characters showed before', () => {
    const blocks = answerBlocks(
      'We release on **Thursdays**, _never_ on a Friday.\n\nRun `pnpm release` first.',
      NONE,
    );
    expect(kinds(blocks)).toEqual(['paragraph', 'paragraph']);
    const [first, second] = blocks as Extract<AnswerBlock, { kind: 'paragraph' }>[];
    expect(first!.inline).toContainEqual({ kind: 'text', text: 'Thursdays', b: true });
    expect(first!.inline).toContainEqual({ kind: 'text', text: 'never', i: true });
    expect(second!.inline).toContainEqual({ kind: 'text', text: 'pnpm release', code: true });
    // No Markdown character is left in what is drawn.
    expect(text(first!.inline) + text(second!.inline)).not.toMatch(/[*_`]/);
  });

  it('reads bulleted, numbered and nested lists as lists', () => {
    const blocks = answerBlocks(
      [
        'Steps:',
        '',
        '1. Tag the build',
        '2. Deploy',
        '   - to staging',
        '   - to production',
        '',
        '- A note',
      ].join('\n'),
      NONE,
    );
    const lists = blocks.filter((b) => b.kind === 'list');
    const first = lists[0]!;
    expect(first.items.map((item) => [item.list, text(item.inline)])).toEqual([
      ['numbered', 'Tag the build'],
      ['numbered', 'Deploy'],
      ...(lists.length === 1 ? [['bullet', 'A note']] : []),
    ]);
    expect(first.items[1]!.items.map((item) => [item.list, text(item.inline)])).toEqual([
      ['bullet', 'to staging'],
      ['bullet', 'to production'],
    ]);
  });

  it('reads a fenced code block as code, its characters untouched', () => {
    const blocks = answerBlocks(
      'Run:\n\n```sh\ngit tag v1 **now** [1]\n```\n\nDone.',
      new Set([1]),
    );
    expect(kinds(blocks)).toEqual(['paragraph', 'code', 'paragraph']);
    expect(blocks[1]).toEqual({ kind: 'code', text: 'git tag v1 **now** [1]' });
  });

  it('reads headings, a quote and a rule, and leaves blank paragraphs out', () => {
    const blocks = answerBlocks('## Releases\n\n> Ship small.\n\n---\n\n\n\nThe end.', NONE);
    expect(kinds(blocks)).toEqual(['heading', 'quote', 'rule', 'paragraph']);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 });
  });

  it('turns a citation marker into a chip, inside formatting too, and never inside code', () => {
    const blocks = answerBlocks(
      '**Thursdays** [1]. Hotfixes [2, 3]. See `rows[1]` and [9].',
      new Set([1, 2, 3]),
    );
    const inline = (blocks[0] as Extract<AnswerBlock, { kind: 'paragraph' }>).inline;
    expect(inline.filter((part) => part.kind === 'cite').map((part) => part.number)).toEqual([
      1, 2, 3,
    ]);
    expect(text(inline)).toBe('Thursdays{1}. Hotfixes{2}{3}. See rows[1] and [9].');
  });
});

describe('what an answer can never do', () => {
  it('keeps a tag the model wrote as the characters it was', () => {
    const blocks = answerBlocks(
      'Look: <img src=x onerror=alert(1)> and <script>alert(1)</script>\n\n<b>bold</b>',
      NONE,
    );
    const drawn = blocks.map((block) => ('inline' in block ? text(block.inline) : '')).join('\n');
    expect(drawn).toContain('<img src=x onerror=alert(1)>');
    expect(drawn).toContain('<script>alert(1)</script>');
    // Every block is one of the kinds drawn here: there is no "html" kind to draw.
    for (const kind of kinds(blocks))
      expect(['paragraph', 'heading', 'quote', 'list', 'code', 'rule', 'table']).toContain(kind);
  });

  it('makes no link pressable: an http or https address is text after its words, any other is its words', () => {
    const blocks = answerBlocks(
      '[docs](https://example.com/a?b=1) [run](javascript:alert(1)) [data](data:text/html,x) [mail](mailto:a@b.c) [rel](/document/x) [https://example.com/x](https://example.com/x)',
      NONE,
    );
    const inline = (blocks[0] as Extract<AnswerBlock, { kind: 'paragraph' }>).inline;
    expect(inline.some((part) => 'href' in part)).toBe(false);
    expect(text(inline)).toBe(
      'docs (https://example.com/a?b=1) run data mail rel https://example.com/x',
    );
    expect(text(inline)).not.toContain('javascript:');
  });

  it('judges an address by its scheme alone', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com/');
    expect(safeHref('HTTP://example.com/x')).toBe('http://example.com/x');
    for (const bad of [
      undefined,
      '',
      'javascript:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>',
      'vbscript:x',
      'file:///etc/passwd',
      'mailto:a@b.c',
      '//example.com',
      '/document/x',
      'https://',
    ])
      expect(safeHref(bad)).toBeUndefined();
  });
});

describe('what formatting an answer costs', () => {
  // The longest answer Ask can end with is bounded by the model's output; 40,000 characters of dense Markdown is
  // well past it. Read once, when the answer ends, never per token.
  it('reads a 40,000 character answer of dense Markdown within its budget', () => {
    const line =
      '- **Deploys** go out on _Tuesdays_ after `standup` [1], see [the runbook](https://example.com/r).\n';
    const answer = line.repeat(Math.ceil(40_000 / line.length));
    answerBlocks(answer, new Set([1]));
    const t0 = cpuNowMs();
    const blocks = answerBlocks(answer, new Set([1]));
    const cpu = cpuNowMs() - t0;
    console.info('[measured] a 40,000 character answer', { cpuMs: Math.round(cpu) });
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Extract<AnswerBlock, { kind: 'list' }>).items.length).toBeGreaterThan(300);
    expect(cpu).toBeLessThan(cpuBudgetMs(100));
  });

  it('is not caught by a long run of unclosed marks', () => {
    const answer = `${'**'.repeat(5_000)}${'['.repeat(5_000)}${'`'.repeat(5_000)}`;
    const t0 = cpuNowMs();
    answerBlocks(answer, new Set([1]));
    expect(cpuNowMs() - t0).toBeLessThan(cpuBudgetMs(150));
  });
});
