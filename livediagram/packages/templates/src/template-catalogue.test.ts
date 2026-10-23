import { describe, expect, it } from 'vitest';
import { templateCatalogue } from './template-catalogue';
import { TEMPLATES } from './templates';
import { TEMPLATE_CATEGORIES } from './template-categories';

describe('templateCatalogue', () => {
  it('lists the categories and every visible template with its category', () => {
    const { categories, templates } = templateCatalogue();
    // Every category, in order, then the blanks.
    expect(categories.slice(0, -1)).toEqual(TEMPLATE_CATEGORIES);
    expect(categories.every((c) => templates.some((t) => t.category === c.id))).toBe(true);
    expect(categories.at(-1)!.id).toBe('blanks');
    expect(templates.find((t) => t.kind === 'blank')!.category).toBe('blanks');
    expect(templates.find((t) => t.kind === 'gantt')!.category).toBe('timelines');
    expect(templates.map((t) => t.kind)).toEqual(
      TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind),
    );
    expect(templates.every((t) => categories.some((c) => c.id === t.category))).toBe(true);
  });
});
