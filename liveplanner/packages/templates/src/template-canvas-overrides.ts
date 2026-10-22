// The tab-level settings a template ships with (templateCanvasOverrides): its backdrop. Its own module, apart from the
// template catalogue in templates.ts: the editor reads the catalogue (a template's title) on every load, and these
// stay out of that first load.
import type { Tab } from '@liveplanner/document';
import type { TemplateKind } from './templates';

// Tab-level overrides a template ships with, applied on top of whatever theme is selected. Plan's boards, Sheets and
// forms (docs/specs/026-plan/plan-mode.md) sit on the quiet dot grid, explicit so it survives a blank-canvas theme:
// the board is the structure. A blank tab keeps the theme's pattern.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  return kind === 'blank' ? {} : { backgroundPattern: 'grid' };
}
