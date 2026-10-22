// The tab-level settings a template ships with (templateCanvasOverrides): its backdrop, layers, mode, pages and
// writing. Its own module, apart from the template catalogue in templates.ts: these read the template builders (a
// template's pages are built here), and the editor reads the catalogue (a template's title) on every load, which
// drew every builder into its first load while the two shared a module.
import type { BackgroundPattern, Tab } from '@livepages/document';
import { articleTemplateOverrides } from './article-template';
import { workingBackwardsOverrides } from './template-working-backwards';
import { blankPageTemplateOverrides } from './blank-page-templates';
import { templateLayers } from './template-layers';
import { templateEditorMode } from './template-modes';
import { templatePages } from './template-pages';
import type { TemplateKind } from './templates';

// The templates whose surround stays plain: the pages are the paper. The Design templates (Floor Plan, Storyboard)
// carry their own paper on their page and keep the theme's pattern round it, as does Blank Tab.
const THEME_PATTERN: ReadonlySet<TemplateKind> = new Set<TemplateKind>([
  'blank',
  'floor-plan',
  'storyboard',
]);
const PAGES_SURROUND: BackgroundPattern = 'blank';

// Tab-level overrides a specific template ships with, applied on top of whatever theme is selected: its surround,
// its layers (docs/specs/006-document/layers.md "Layered templates", matching the `layerId`s its builder pre-stamps),
// the mode it opens in, and its pages and writing, so every application path (the picker, /new, the MCP worker)
// lands them in one commit.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  const overrides: Partial<Tab> = { opensIn: templateEditorMode(kind) };
  if (!THEME_PATTERN.has(kind)) overrides.backgroundPattern = PAGES_SURROUND;
  const layers = templateLayers(kind);
  if (layers) overrides.layers = layers;
  // The Article opens on its one article page (docs/specs/007-editor/article-pages.md).
  if (kind === 'article') Object.assign(overrides, articleTemplateOverrides());
  // Working Backwards is an article too: its PR/FAQ flows onto pages in the Report look (template-working-backwards.ts).
  if (kind === 'working-backwards') Object.assign(overrides, workingBackwardsOverrides());
  // A blank of a page kind opens on its one page, its kind already chosen (blank-page-templates.ts).
  const blankPage = blankPageTemplateOverrides(kind);
  if (blankPage) Object.assign(overrides, blankPage);
  // The templates on pages (canvas-and-palette.md "Templates on pages"); their builders place every element on them.
  const pages = templatePages(kind);
  if (pages) overrides.pages = pages;
  return overrides;
}
