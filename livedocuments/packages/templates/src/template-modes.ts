// The blanks (docs/specs/008-canvas/canvas-and-palette.md "Templates").
import type { TemplateKind } from './templates';

/** The blank (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Blank Illustration, one empty page that asks
 *  what it is for. */
export const BLANK_TEMPLATE: TemplateKind = 'blank-illustration';

// The blanks beyond Blank Illustration (docs/specs/007-editor/start-diagramming.md "Recommended and groups"): one empty
// page of a chosen kind, beside Blank Illustration, in the order the landing page's Blank Slate lists them.
export const EXTRA_BLANK_TEMPLATES: readonly TemplateKind[] = [
  'blank-slide-deck',
  'blank-article',
  'blank-infographic',
];

/** True for the blanks: Blank Illustration, the blanks of a page kind, and Blank Tab (the plain empty tab an agent or a
 *  `/new?blank` link makes by name). Quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return kind === 'blank' || kind === BLANK_TEMPLATE || EXTRA_BLANK_TEMPLATES.includes(kind);
}
