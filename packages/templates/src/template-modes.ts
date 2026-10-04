// The editor mode each template opens in (docs/specs/007-editor/templates-by-mode.md "A template's
// mode"): declared once here, read by the template step (its mode filter and the glyph on every
// card) and by templateCanvasOverrides (the tab's `opensIn`), so the two can never disagree.
import type { EditorMode } from '@livediagram/document';
import type { TemplateKind } from './templates';

// Every template not named here is a Diagram template.
const TEMPLATE_MODES: Partial<Record<TemplateKind, EditorMode>> = {
  whiteboard: 'draw',
  sketchnote: 'draw',
  'rich-picture': 'draw',
  'comic-strip': 'draw',
  'doodle-warmup': 'draw',
  'blank-illustration': 'illustrate',
  article: 'illustrate',
  'slide-deck': 'illustrate',
  'logo-design': 'illustrate',
  'live-card': 'illustrate',
  'event-poster': 'illustrate',
  'year-in-review': 'illustrate',
  resume: 'illustrate',
  'recipe-card': 'illustrate',
};

/** The mode a template's tab opens in. */
export function templateEditorMode(kind: TemplateKind): EditorMode {
  return TEMPLATE_MODES[kind] ?? 'diagram';
}

/** Each mode's blank (docs/specs/007-editor/templates-by-mode.md "Three blanks"). */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  diagram: 'blank',
  draw: 'whiteboard',
  illustrate: 'blank-illustration',
};

/** True for the three blanks: quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return Object.values(BLANK_TEMPLATE_FOR_MODE).includes(kind);
}
