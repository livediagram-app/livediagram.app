// The editor mode each template opens in (docs/specs/007-editor/pages-mode.md "One mode"): livepages
// has one mode, Pages, so every template opens there. Read by the template step (its mode filter and the glyph on
// every card) and by templateCanvasOverrides (the tab's `opensIn`), so the two can never disagree.
import type { EditorMode } from '@livepages/document';
import type { TemplateKind } from './templates';

/** The mode a template's tab opens in: always Pages. */
export function templateEditorMode(_kind: TemplateKind): EditorMode {
  return 'pages';
}

/** The mode's blank (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Blank Illustration, one empty page
 *  that asks what it is for. */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  pages: 'blank-illustration',
};

// The blanks beyond the mode's own (docs/specs/007-editor/start-diagramming.md "Recommended and groups"): one empty
// page of a chosen kind, beside Blank Illustration, in the order the landing page's Blank Slate lists them.
export const EXTRA_BLANK_TEMPLATES: readonly TemplateKind[] = [
  'blank-slide-deck',
  'blank-article',
  'blank-infographic',
  'blank-logo',
  'blank-wireframe-phone',
  'blank-wireframe-tablet',
  'blank-wireframe-browser',
  'blank-wireframe-laptop',
  'blank-wireframe-watch',
];

/** True for the blanks: the mode's, the blanks of a page kind, and Blank Tab (the plain empty tab an agent or a
 *  `/new?blank` link makes by name). Quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return (
    kind === 'blank' ||
    Object.values(BLANK_TEMPLATE_FOR_MODE).includes(kind) ||
    EXTRA_BLANK_TEMPLATES.includes(kind)
  );
}
