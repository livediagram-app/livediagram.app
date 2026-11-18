import { describe, expect, it } from 'vitest';
import {
  clearTabExamples,
  hasUntouchedExamples,
  isSampleCopy,
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
  it("a Live Card's notes and body copy clear, and every element keeps its place", () => {
    const [tab] = buildTemplatedTabs('live-card', 'slate', 't1', 'Tab 1');
    // Seven notes and three lines of body copy.
    expect(untouchedExampleCount(tab!.elements)).toBe(10);
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

  it("a Recipe Card's body copy clears, and its headings, labels and figures stay", () => {
    const [tab] = buildTemplatedTabs('recipe-card', 'slate', 't1', 'Tab 1');
    const before = tab!.elements;
    expect(before.some((el) => el.type === 'text' && isSampleCopy(el))).toBe(true);
    expect(hasUntouchedExamples(before)).toBe(true);
    const [cleared] = clearTabExamples([tab!], 't1');
    cleared!.elements.forEach((el, i) => {
      const was = before[i]!;
      if (el.type !== 'text' || was.type !== 'text') return;
      expect(el.label).toBe(isSampleCopy(was) ? '' : was.label);
      expect([el.x, el.y, el.width, el.height, el.textSize]).toEqual([
        was.x,
        was.y,
        was.width,
        was.height,
        was.textSize,
      ]);
    });
    // The title is bold display type: it stays.
    expect(
      cleared!.elements.some((el) => el.type === 'text' && el.label === 'Butter Bean Bake'),
    ).toBe(true);
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
