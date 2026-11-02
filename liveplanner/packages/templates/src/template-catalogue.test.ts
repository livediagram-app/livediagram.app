import { describe, expect, it } from 'vitest';
import { templateCatalogue } from './template-catalogue';
import { TEMPLATES } from './templates';
import { TEMPLATE_CATEGORIES } from './template-categories';

describe('templateCatalogue', () => {
  it('lists the categories and every visible template with its category', () => {
    const { categories, templates } = templateCatalogue();
    // Every category, in order: each holds a template an agent can make (a form sits beside a board or a sheet of
    // its job), though a category of editor-only templates alone would be left out.
    expect(categories.slice(0, -1)).toEqual(TEMPLATE_CATEGORIES);
    expect(categories.every((c) => templates.some((t) => t.category === c.id))).toBe(true);
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
