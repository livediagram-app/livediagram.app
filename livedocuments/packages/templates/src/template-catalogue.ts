// The template library as the agent front doors list it (docs/specs/015-api/blueprints/cli.md "Catalogue routes"):
// @liveworkspace/template-previews/template-catalogue, bound to this product's templates and categories, the
// editor's hidden onboarding templates left out.
import { createTemplateCatalogue } from '@liveworkspace/template-previews/template-catalogue';
import { TEMPLATE_CATEGORIES, templateCategory } from './template-categories';
import { TEMPLATES } from './templates';

export const templateCatalogue = createTemplateCatalogue({
  templates: TEMPLATES.filter((t) => !t.hidden),
  categories: TEMPLATE_CATEGORIES,
  categoryOf: templateCategory,
  blanksDescription: 'An empty page or tab, to start from nothing.',
});
