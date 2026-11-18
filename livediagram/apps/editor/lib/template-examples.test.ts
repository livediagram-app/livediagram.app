import { describe, expect, it } from 'vitest';
import {
  clearTabExamples,
  hasUntouchedExamples,
  keepTabExamples,
  untouchedExampleCount,
  type Element,
} from '@livediagram/document';
import { buildTemplatedTab } from './template-builders';

// docs/specs/006-document/template-examples.md: a template a person picks lands with its example values marked, and
// Clear Example Content empties them and keeps every element where and how it was.

const textOf = (el: Element) => (el as { label?: string }).label ?? '';
// Everything about an element but its example values: where it is and how it looks.
const placeOf = (el: Element) => {
  const {
    label: _l,
    richText: _r,
    checklistItems: _c,
    templateExample: _m,
    ...rest
  } = el as Element & Record<string, unknown>;
  return rest;
};

describe('template example content', () => {
  it('the Eisenhower Matrix clears to empty notes and an empty checklist, its quadrants kept', () => {
    const tab = buildTemplatedTab('eisenhower-matrix', 'slate', 't1', 'Tab 1');
    expect(untouchedExampleCount(tab.elements)).toBe(17);
    const [cleared] = clearTabExamples([tab], 't1');
    const after = cleared!.elements;
    expect(after).toHaveLength(tab.elements.length);
    expect(hasUntouchedExamples(after)).toBe(false);
    for (const el of after.filter((e) => e.type === 'sticky')) expect(textOf(el)).toBe('');
    const checklist = after.find((e) => e.type === 'shape' && e.checklistItems)!;
    expect(
      checklist.type === 'shape' && checklist.checklistItems!.every((r) => !r.text && !r.done),
    ).toBe(true);
    // Quadrant headings, prompts and the title stay as the template wrote them; every element keeps its place and look.
    after.forEach((el, i) => {
      const before = tab.elements[i]!;
      expect(placeOf(el)).toEqual(placeOf(before));
      if (el.type === 'text' || (el.type === 'shape' && !el.checklistItems)) {
        expect(textOf(el)).toBe(textOf(before));
      }
    });
  });

  it("a checklist template's rows and ticks clear, and a note someone wrote stays", () => {
    const tab = buildTemplatedTab('meeting-agenda', 'slate', 't1', 'Tab 1');
    const firstSticky = tab.elements.findIndex((e) => e.type === 'sticky');
    const written = tab.elements.map((el, i) =>
      i === firstSticky ? { ...el, label: 'Our real agenda' } : el,
    );
    const [cleared] = clearTabExamples([{ ...tab, elements: written }], 't1');
    expect(textOf(cleared!.elements[firstSticky]!)).toBe('Our real agenda');
    const lists = cleared!.elements.filter((e) => e.type === 'shape' && e.checklistItems);
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(
        list.type === 'shape' && list.checklistItems!.every((r) => r.text === '' && !r.done),
      ).toBe(true);
    }
  });

  it('Keep It keeps every value and offers nothing more', () => {
    const tab = buildTemplatedTab('retrospective', 'slate', 't1', 'Tab 1');
    const [kept] = keepTabExamples([tab], 't1');
    expect(kept!.elements.map(textOf)).toEqual(tab.elements.map(textOf));
    expect(hasUntouchedExamples(kept!.elements)).toBe(false);
  });

  it("the Fishbone's causes clear as sample copy; its title, guide line and labels stay", () => {
    const tab = buildTemplatedTab('fishbone', 'slate', 't1', 'Tab 1');
    // Six bones, two causes each.
    expect(untouchedExampleCount(tab.elements)).toBe(12);
    const [cleared] = clearTabExamples([tab], 't1');
    const texts = cleared!.elements.filter((el) => el.type === 'text').map(textOf);
    expect(texts.filter((t) => t === '')).toHaveLength(12);
    expect(texts).not.toContain('Peak days run understaffed');
    expect(texts).not.toContain('Courier cut-off is 3pm');
    expect(texts).toContain('The problem');
    expect(texts).toContain('FreshBox · why do orders ship late?');
    expect(texts).toContain('Likely root cause: test these two first');
    expect(hasUntouchedExamples(cleared!.elements)).toBe(false);
  });

  it('the Timeline, the Roadmap and the Venn offer their sample copy too', () => {
    for (const kind of ['timeline', 'roadmap', 'venn'] as const) {
      expect(hasUntouchedExamples(buildTemplatedTab(kind, 'slate', 't1', 'Tab 1').elements)).toBe(
        true,
      );
    }
  });

  it('a template without example values carries no mark', () => {
    const tab = buildTemplatedTab('flowchart', 'slate', 't1', 'Tab 1');
    expect(tab.elements.some((el) => 'templateExample' in el)).toBe(false);
  });
});
