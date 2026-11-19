// @vitest-environment jsdom
// The worst case the caps allow stays linear (docs/specs/020-import-export/blueprints/visio-import.md "Performance
// and limits"): a page of 10 000 shapes, half of them connectors glued at both ends, imports inside a CPU budget,
// and the shapes past the per-tab cap are counted rather than read.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { importVisio } from './import';
import { connector, glue, onePage, rectGeometry, shape } from './test-support';

function worstPage(boxes: number) {
  const parts: string[] = [];
  const connects: string[] = [];
  for (let i = 0; i < boxes; i++) {
    const x = (i % 100) * 2;
    const y = Math.floor(i / 100) * 2;
    parts.push(
      shape(i + 1, { x, y, w: 1, h: 0.5 }, { inner: rectGeometry(1, 0.5), text: `Step ${i}` }),
    );
    if (i > 0) {
      const id = boxes + i;
      parts.push(connector(id, { x: x - 1.5, y }, { x: x - 0.5, y }));
      connects.push(glue(id, 'BeginX', i), glue(id, 'EndX', i + 1));
    }
  }
  return onePage(parts.join(''), connects.join(''), { method: 'stored' });
}

describe('worst case', () => {
  it(`imports 10 000 shapes and their connectors inside ${cpuBudgetMs(6000)} ms of CPU`, async () => {
    const bytes = worstPage(5000);
    let elements = 0;
    const ms = await cpuMsOfAsync(async () => {
      const result = await importVisio(bytes, { tabIdForPage: () => 'tab' });
      if (!result.ok) throw new Error(result.error);
      elements = result.pages[0]!.elements.length;
    });
    expect(elements).toBe(9999);
    expect(ms).toBeLessThan(cpuBudgetMs(6000));
  }, 120_000);

  it('counts the shapes past the per-tab cap instead of reading them', async () => {
    const result = await importVisio(worstPage(5002), { tabIdForPage: () => 'tab' });
    if (!result.ok) throw new Error(result.error);
    expect(result.pages[0]!.elements.length).toBe(10_000);
    expect(result.report.notes.find((n) => n.kind === 'content-truncated')?.count).toBe(3);
  }, 120_000);
});
