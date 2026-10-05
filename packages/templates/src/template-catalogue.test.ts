import { describe, expect, it } from 'vitest';
import { templateCatalogue } from './template-catalogue';
import { TEMPLATES, TEMPLATE_CATEGORIES } from './templates';

describe('templateCatalogue', () => {
  it('lists the categories and every visible template with its category', () => {
    const { categories, templates } = templateCatalogue();
    expect(categories).toBe(TEMPLATE_CATEGORIES);
    expect(templates.map((t) => t.kind)).toEqual(
      TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind),
    );
    expect(templates.every((t) => categories.some((c) => c.id === t.category))).toBe(true);
  });
});
