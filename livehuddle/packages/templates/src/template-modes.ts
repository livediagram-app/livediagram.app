// The editor mode each template opens in (docs/specs/007-editor/templates-by-mode.md "A template's mode"): every
// board is Workshop, so every template opens there. Read by the template step and the marketing gallery.
import type { EditorMode } from '@livehuddle/document';
import type { TemplateKind } from './templates';

/** The mode a template's tab opens in: Workshop, the one mode. */
export function templateEditorMode(_kind: TemplateKind): EditorMode {
  return 'workshop';
}

/** Workshop's blank (docs/specs/007-editor/templates-by-mode.md "The blank"). */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  workshop: 'blank-session',
};

/** True for the blank, Blank Workshop: in no category, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return kind === BLANK_TEMPLATE_FOR_MODE.workshop;
}
