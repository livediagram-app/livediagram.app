import { describe, expect, it } from 'vitest';
import {
  clearTabExamples,
  hasUntouchedExamples,
  isSampleCopy,
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

// An element as it was before its mark: what clearing keeps besides its emptied words.
const stripMark = (el: Element) => {
  const {
    templateExample: _mark,
    richText: _runs,
    ...rest
  } = el as Element & {
    templateExample?: string;
    richText?: unknown;
  };
  return rest;
};

describe('template example content', () => {
  it("the Dashboard wireframe's chart keeps its names and drops its numbers", () => {
    const tabs = buildTemplatedTabs('wireframe-dashboard', 'slate', 't1', 'Tab 1');
    const tab = tabs.find((t) => hasUntouchedExamples(t.elements))!;
    const [cleared] = clearTabExamples([tab], tab.id);
    expect(cleared!.elements).toHaveLength(tab.elements.length);
    const chart = cleared!.elements.find((el) => chartValues(el).length > 0)!;
    expect(chartValues(chart).every((v) => v === 0)).toBe(true);
  });

  it("a wireframe's body copy clears, and its headings, nav words and figures stay", () => {
    const [tab] = buildTemplatedTabs('wireframe-mobile-app', 'slate', 't1', 'Tab 1');
    const before = tab!.elements;
    const body = before.filter((el) => el.type === 'text' && isSampleCopy(el));
    expect(body.length).toBeGreaterThan(0);
    expect(untouchedExampleCount(before)).toBeGreaterThanOrEqual(body.length);
    const [cleared] = clearTabExamples([tab!], 't1');
    cleared!.elements.forEach((el, i) => {
      const was = before[i]!;
      if (el.type !== 'text') return;
      // Every text keeps its box and look; only its words go, and only body copy's.
      expect({ ...stripMark(el), label: '' }).toEqual({ ...stripMark(was), label: '' });
      expect(el.label).toBe(isSampleCopy(was) ? '' : was.label);
    });
    expect(hasUntouchedExamples(cleared!.elements)).toBe(false);
  });

  it('a logo template carries no mark: its words are the mark itself', () => {
    for (const kind of ['logo-design', 'logo-lockups', 'logo-wordmarks'] as const) {
      for (const tab of buildTemplatedTabs(kind, 'slate', 't1', 'Tab 1')) {
        expect(tab.elements.some((el) => 'templateExample' in el)).toBe(false);
      }
    }
  });
});
