// The template search (docs/specs/008-canvas/canvas-and-palette.md "Template categories", Search):
// @liveworkspace/template-previews/template-search, bound to this product's categories and search words.
import { createTemplateSearch } from '@liveworkspace/template-previews/template-search';
import {
  templateCategories,
  templateCategoryLabel,
  templateCategorySearchWords,
} from './template-categories';
import { templateKeywords } from './template-keywords';
import type { TemplateKind } from './templates';

export { templateQueryWords } from '@liveworkspace/template-previews/template-search';

export const templateMatchesQuery = createTemplateSearch<TemplateKind>((kind) => [
  ...templateCategories(kind).map(templateCategoryLabel),
  ...templateCategories(kind).map(templateCategorySearchWords),
  ...templateKeywords(kind),
]);
