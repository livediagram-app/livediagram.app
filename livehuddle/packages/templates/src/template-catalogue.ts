// The template library as the api lists it (GET /api/templates, after
// livediagram/docs/specs/015-api/blueprints/cli.md "Catalogue routes"):
// @liveworkspace/template-previews/template-catalogue, bound to this product's templates and categories, the
// editor's hidden onboarding templates left out.
import {
  createAutomationTabTemplates,
  createTemplateCatalogue,
} from '@liveworkspace/template-previews/template-catalogue';
import { TEMPLATE_CATEGORIES, templateCategory } from './template-categories';
import { TEMPLATES } from './templates';

export const templateCatalogue = createTemplateCatalogue({
  templates: TEMPLATES.filter((t) => !t.hidden),
  categories: TEMPLATE_CATEGORIES,
  categoryOf: templateCategory,
  blanksDescription: 'An empty tab in each mode, to start from nothing.',
});

// The templates a rule's Add a Tab from a Template step may name (docs/specs/013-workspace/automations.md): this
// catalogue's, in its order. A template's id is its kind.
export const { automationTabTemplates, automationTabTemplateNames } =
  createAutomationTabTemplates(templateCatalogue);
export type { AutomationTabTemplate } from '@liveworkspace/template-previews/template-catalogue';
