// The template library as the agent front doors list it (the MCP's list_templates, the api's GET /api/templates,
// docs/specs/015-api/blueprints/cli.md "Catalogue routes"): the categories and one entry a template, the editor's
// hidden onboarding templates left out. A template's category is its primary (docs/specs/008-canvas/canvas-and-palette.md
// "Template categories"); the five blanks, in no category in the picker, are listed under `blanks` so an agent still
// finds them.
import { TEMPLATES, type TemplateKind } from './templates';
import {
  TEMPLATE_CATEGORIES,
  templateCategory,
  type TemplateCategory,
} from './template-categories';

export const BLANKS_CATALOGUE_CATEGORY = {
  id: 'blanks',
  label: 'Blanks',
  description: 'An empty tab in each mode, to start from nothing.',
} as const;

export type TemplateCatalogue = {
  categories: { id: TemplateCategory | 'blanks'; label: string; description: string }[];
  templates: {
    kind: TemplateKind;
    title: string;
    description: string;
    category: TemplateCategory | 'blanks';
  }[];
};

export function templateCatalogue(): TemplateCatalogue {
  return {
    categories: [...TEMPLATE_CATEGORIES, BLANKS_CATALOGUE_CATEGORY],
    templates: TEMPLATES.filter((t) => !t.hidden && !t.editorOnly).map((t) => ({
      kind: t.kind,
      title: t.title,
      description: t.description,
      category: templateCategory(t.kind) ?? 'blanks',
    })),
  };
}
