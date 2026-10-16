import { describe, expect, it } from 'vitest';
import { templateCatalogue } from './template-catalogue';
import { TEMPLATES } from './templates';
import { TEMPLATE_CATEGORIES } from './template-categories';

describe('templateCatalogue', () => {
  it('lists the categories and every visible template with its category', () => {
    const { categories, templates } = templateCatalogue();
    expect(categories.slice(0, -1)).toEqual([...TEMPLATE_CATEGORIES]);
    expect(categories.at(-1)!.id).toBe('blanks');
    expect(templates.find((t) => t.kind === 'blank')!.category).toBe('blanks');
    expect(templates.find((t) => t.kind === 'invoice')!.category).toBe('finance');
    expect(templates.map((t) => t.kind)).toEqual(
      TEMPLATES.filter((t) => !t.hidden && !t.editorOnly).map((t) => t.kind),
    );
    // A form template is the editor's to start: never offered to an agent.
    expect(templates.some((t) => t.kind.endsWith('-form'))).toBe(false);
    expect(templates.every((t) => categories.some((c) => c.id === t.category))).toBe(true);
  });
});
