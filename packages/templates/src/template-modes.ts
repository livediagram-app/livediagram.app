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
  'paper-prototype': 'draw',
  'journey-doodle': 'draw',
  'pre-mortem': 'draw',
  'idea-garden': 'draw',
  'blank-illustration': 'illustrate',
  article: 'illustrate',
  'slide-deck': 'illustrate',
  'logo-design': 'illustrate',
  'live-card': 'illustrate',
  'event-poster': 'illustrate',
  'year-in-review': 'illustrate',
  resume: 'illustrate',
  'recipe-card': 'illustrate',
  'data-story': 'illustrate',
  'how-it-works': 'illustrate',
  versus: 'illustrate',
  'social-carousel': 'illustrate',
  // Plan templates (docs/specs/025-plan/plan-mode.md "Templates").
  'blank-plan': 'plan',
  kanban: 'plan',
  'sprint-board': 'plan',
  'bug-triage': 'plan',
  'team-retro': 'plan',
  'roadmap-board': 'plan',
  'weekly-planner': 'plan',
  'project-overview': 'plan',
  'daily-standup': 'plan',
  'content-calendar': 'plan',
  'hiring-pipeline': 'plan',
};

/** The mode a template's tab opens in. */
export function templateEditorMode(kind: TemplateKind): EditorMode {
  return TEMPLATE_MODES[kind] ?? 'diagram';
}

/** Each mode's blank (docs/specs/007-editor/templates-by-mode.md "Four blanks"). */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  diagram: 'blank',
  draw: 'whiteboard',
  illustrate: 'blank-illustration',
  plan: 'blank-plan',
};

/** True for the four blanks: quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return Object.values(BLANK_TEMPLATE_FOR_MODE).includes(kind);
}
