// The template library as the agent front doors list it (the MCP's list_templates, the api's GET /api/templates,
// docs/specs/015-api/blueprints/cli.md "Catalogue routes"): the categories and one entry a template, the editor's
// hidden onboarding templates left out.

import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  templateCategory,
  type TemplateCategory,
  type TemplateKind,
} from './templates';

export type TemplateCatalogue = {
  categories: typeof TEMPLATE_CATEGORIES;
  templates: {
    kind: TemplateKind;
    title: string;
    description: string;
    category: TemplateCategory;
  }[];
};

export function templateCatalogue(): TemplateCatalogue {
  return {
    categories: TEMPLATE_CATEGORIES,
    templates: TEMPLATES.filter((t) => !t.hidden).map((t) => ({
      kind: t.kind,
      title: t.title,
      description: t.description,
      category: templateCategory(t.kind),
    })),
  };
}
