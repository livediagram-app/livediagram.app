// The editor mode each template opens in (docs/specs/007-editor/templates-by-mode.md "A template's mode"): every
// board is Workshop, so every template opens there. Read by the template step and the marketing gallery.
import type { EditorMode } from '@livehuddle/document';
import type { TemplateKind } from './templates';

/** The mode a template's tab opens in: Workshop, the one mode. */
export function templateEditorMode(_kind: TemplateKind): EditorMode {
  return 'workshop';
}

/** Workshop's blank (docs/specs/007-editor/templates-by-mode.md "The blanks"). */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  workshop: 'blank-session',
};

// The blanks: Workshop's, and the empty Diagram and Draw boards it absorbed, kept until the templates are cut down
// to Workshop's (docs/specs/005-project-roadmap/build-plan.md step 5.4). In no category and not on Popular.
const BLANKS: ReadonlySet<TemplateKind> = new Set<TemplateKind>([
  'blank',
  'whiteboard',
  'blank-session',
]);

/** True for the blanks. Never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return BLANKS.has(kind);
}
