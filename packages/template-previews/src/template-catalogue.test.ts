import { describe, expect, it } from 'vitest';
import { createTemplateCatalogue } from './template-catalogue';

type Kind = 'blank' | 'flowchart' | 'retro';
type Category = 'diagrams' | 'meetings' | 'forms';

const templateCatalogue = createTemplateCatalogue<Kind, Category>({
  templates: [
    { kind: 'blank', title: 'Blank', description: 'Nothing yet.' },
    { kind: 'flowchart', title: 'Flowchart', description: 'Steps and decisions.' },
    { kind: 'retro', title: 'Retro', description: 'What went well.' },
  ],
  categories: [
    { id: 'diagrams', label: 'Diagrams', description: 'Boxes and lines.' },
    { id: 'forms', label: 'Forms', description: 'Questions to fill in.' },
    { id: 'meetings', label: 'Meetings', description: 'Run a meeting.' },
  ],
  categoryOf: (kind) => (kind === 'flowchart' ? 'diagrams' : kind === 'retro' ? 'meetings' : null),
  blanksDescription: 'An empty tab, to start from nothing.',
});

describe('createTemplateCatalogue', () => {
  it('lists each template under its category, a blank under Blanks', () => {
    expect(templateCatalogue().templates).toEqual([
      { kind: 'blank', title: 'Blank', description: 'Nothing yet.', category: 'blanks' },
      { kind: 'flowchart', title: 'Flowchart', description: 'Steps and decisions.', category: 'diagrams' },
      { kind: 'retro', title: 'Retro', description: 'What went well.', category: 'meetings' },
    ]);
  });

  it('offers only the categories something is listed in, in order, Blanks last', () => {
    expect(templateCatalogue().categories).toEqual([
      { id: 'diagrams', label: 'Diagrams', description: 'Boxes and lines.' },
      { id: 'meetings', label: 'Meetings', description: 'Run a meeting.' },
      { id: 'blanks', label: 'Blanks', description: 'An empty tab, to start from nothing.' },
    ]);
  });

  it('leaves Blanks out when no blank is listed', () => {
    const noBlanks = createTemplateCatalogue<Kind, Category>({
      templates: [{ kind: 'retro', title: 'Retro', description: 'What went well.' }],
      categories: [{ id: 'meetings', label: 'Meetings', description: 'Run a meeting.' }],
      categoryOf: () => 'meetings',
      blanksDescription: 'Unused.',
    });
    expect(noBlanks().categories.map((c) => c.id)).toEqual(['meetings']);
  });
});
