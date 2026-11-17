import { describe, expect, it } from 'vitest';
import {
  clearTabExamples,
  hasUntouchedExamples,
  untouchedExampleCount,
  type Element,
} from '@livedocuments/document';
import { buildTemplatedTabs } from './template-builders';

// docs/specs/006-document/template-examples.md: a template a person picks lands with its example values marked, and
// Clear Example Content empties them and keeps every element where and how it was.

const chartValues = (el: Element) =>
  el.type === 'shape'
    ? [
        ...(el.pieSlices ?? []).map((s) => s.value),
        ...(el.lineSeries ?? []).flatMap((s) => s.values),
      ]
    : [];

describe('template example content', () => {
  it("a Live Card's notes clear, and every element keeps its place", () => {
    const [tab] = buildTemplatedTabs('live-card', 'slate', 't1', 'Tab 1');
    expect(untouchedExampleCount(tab!.elements)).toBe(7);
    const [cleared] = clearTabExamples([tab!], 't1');
    expect(cleared!.elements).toHaveLength(tab!.elements.length);
    for (const el of cleared!.elements.filter((e) => e.type === 'sticky')) {
      expect((el as { label?: string }).label).toBe('');
    }
    cleared!.elements.forEach((el, i) => {
      const before = tab!.elements[i] as { x?: number; y?: number };
      expect([(el as { x?: number }).x, (el as { y?: number }).y]).toEqual([before.x, before.y]);
    });
    expect(hasUntouchedExamples(cleared!.elements)).toBe(false);
  });

  it("a Quarterly Review's chart keeps its names and drops its numbers", () => {
    const tabs = buildTemplatedTabs('quarterly-review', 'slate', 't1', 'Tab 1');
    const tab = tabs.find((t) => hasUntouchedExamples(t.elements))!;
    const [cleared] = clearTabExamples([tab], tab.id);
    const chart = cleared!.elements.find((el) => chartValues(el).length > 0)!;
    expect(chartValues(chart).every((v) => v === 0)).toBe(true);
  });
});
