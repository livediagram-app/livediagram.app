// The splitter runs over every document of the production database, tabs up to 2 MB: a large mixed Pages tab must
// split well inside a budget, so a quadratic step (elements x pages, a re-parse per element) fails here.
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { doc, hooks, shape } from './split-fixtures';
import { splitOldDocument } from './split';

describe('splitOldDocument at size', () => {
  it('splits 5,000 elements across 20 mixed pages within budget', () => {
    const pages = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      kind: i % 2 ? 'logo' : 'slide',
    }));
    // Slides are 1280 wide and logos 512, with an 80 gap: each element sits on its page of the same row.
    const starts: number[] = [];
    let x = 0;
    for (const p of pages) {
      starts.push(x);
      x += (p.kind === 'logo' ? 512 : 1280) + 80;
    }
    const label = 'A label long enough to make the body a realistic size. '.repeat(4);
    const elements = Array.from({ length: 5000 }, (_, i) =>
      shape(`e${i}`, starts[i % 20]! + 10 + (i % 7), 10 + (i % 11), {
        label,
        ...(i % 50 === 0 ? { link: { kind: 'tab', tabId: 't2' } } : {}),
      }),
    );
    const input = doc([
      { id: 't1', body: { opensIn: 'pages', pages, elements } },
      { id: 't2', body: { elements: [shape('d', 0, 0)] } },
    ]);
    expect(input.tabs[0]!.data.length).toBeGreaterThan(1_000_000);
    let result: ReturnType<typeof splitOldDocument> | undefined;
    const ms = cpuMsOf(() => {
      result = splitOldDocument(input, hooks());
    });
    const design = result!.parts.find((p) => p.app === 'livedesign')!;
    const docs = result!.parts.find((p) => p.app === 'livedocuments')!;
    expect(design.tabs[0]!.elementCount).toBe(2500);
    expect(docs.tabs[0]!.elementCount).toBe(2500);
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
