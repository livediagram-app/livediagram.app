import { describe, expect, it } from 'vitest';
import {
  clearTabExamples,
  hasUntouchedExamples,
  untouchedExampleCount,
  type Element,
} from '@livedesign/design';
import { buildTemplatedTabs } from './template-builders';

// docs/specs/006-design/template-examples.md: a template a person picks lands with its example values marked, and
// Clear Example Content empties them and keeps every element where and how it was.

const chartValues = (el: Element) =>
  el.type === 'shape'
    ? [
        ...(el.pieSlices ?? []).map((s) => s.value),
        ...(el.lineSeries ?? []).flatMap((s) => s.values),
      ]
    : [];

describe('template example content', () => {
  it("the Dashboard wireframe's chart keeps its names and drops its numbers, its copy kept", () => {
    const tabs = buildTemplatedTabs('wireframe-dashboard', 'slate', 't1', 'Tab 1');
    const tab = tabs.find((t) => hasUntouchedExamples(t.elements))!;
    expect(untouchedExampleCount(tab.elements)).toBe(1);
    const [cleared] = clearTabExamples([tab], tab.id);
    expect(cleared!.elements).toHaveLength(tab.elements.length);
    const chart = cleared!.elements.find((el) => chartValues(el).length > 0)!;
    expect(chartValues(chart).every((v) => v === 0)).toBe(true);
    // The wireframe's own copy (its texts and labels) is the design, not an example: it stays.
    cleared!.elements.forEach((el, i) => {
      if (el !== chart) expect(el).toEqual(tab.elements[i]);
    });
  });

  it('a logo template carries no mark', () => {
    const [tab] = buildTemplatedTabs('logo-design', 'slate', 't1', 'Tab 1');
    expect(tab!.elements.some((el) => 'templateExample' in el)).toBe(false);
  });
});
