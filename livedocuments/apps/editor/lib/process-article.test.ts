// Add to Knowledgebase's trigger (docs/specs/013-workspace/suggestions.md): an article that explains a process.
import { describe, expect, it } from 'vitest';
import type { ArticleBlock, ArticleFlow } from '@livedocuments/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { explainsProcess } from './process-article';

let n = 0;
const p = (text: string, style?: string): ArticleBlock =>
  ({
    id: `b${n++}`,
    type: 'paragraph',
    ...(style ? { style } : {}),
    runs: [{ text }],
  }) as ArticleBlock;
const li = (text: string, list = 'numbered', level?: number): ArticleBlock =>
  ({
    id: `b${n++}`,
    type: 'list',
    list,
    ...(level ? { level } : {}),
    runs: [{ text }],
  }) as ArticleBlock;
const flow = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });

describe('explainsProcess', () => {
  it('reads three numbered steps in a row as a process', () => {
    expect(explainsProcess([flow(p('Intro'), li('Open'), li('Pick'), li('Save'))])).toBe(true);
  });

  it('reads three Step headings as a process', () => {
    expect(
      explainsProcess([
        flow(p('Step 1: open', 'h2'), p('x'), p('Step two', 'h2'), p('Step 3', 'h3')),
      ]),
    ).toBe(true);
  });

  it('reads a How To title with a list of three as a process', () => {
    expect(
      explainsProcess([
        flow(
          p('How to release', 'title'),
          li('Tag', 'bullet'),
          li('Build', 'bullet'),
          li('Ship', 'todo'),
        ),
      ]),
    ).toBe(true);
    expect(
      explainsProcess([
        flow(
          p('How we hire', 'h1'),
          li('Post', 'bullet'),
          li('Screen', 'bullet'),
          li('Offer', 'bullet'),
        ),
      ]),
    ).toBe(true);
  });

  it('reads none in prose, a short list, a broken run, nested items or a bullet list without a How To', () => {
    expect(explainsProcess([])).toBe(false);
    expect(explainsProcess([flow(p('Notes'), p('Thoughts on the quarter.'))])).toBe(false);
    expect(explainsProcess([flow(li('A'), li('B'))])).toBe(false);
    expect(explainsProcess([flow(li('A'), li('B'), p('Between'), li('C'))])).toBe(false);
    expect(
      explainsProcess([
        flow(li('A'), li('B', 'numbered', 1), li('C', 'numbered', 1), li('D', 'bullet')),
      ]),
    ).toBe(false);
    expect(explainsProcess([flow(li('A', 'bullet'), li('B', 'bullet'), li('C', 'bullet'))])).toBe(
      false,
    );
    expect(
      explainsProcess([
        flow(p('How', 'h1'), li('A', 'bullet'), li('B', 'bullet'), li('C', 'bullet')),
      ]),
    ).toBe(false);
  });

  it('checks a long article well within budget (measured)', () => {
    const blocks: ArticleBlock[] = [];
    for (let i = 0; i < 5_000; i++)
      blocks.push(p(`Paragraph ${i} with some words in it`, i % 50 === 0 ? 'h2' : undefined));
    const ms = cpuMsOf(() => explainsProcess([flow(...blocks)]));
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });
});
