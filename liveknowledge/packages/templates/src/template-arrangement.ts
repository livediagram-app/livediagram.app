// How a template's pages stand (docs/specs/008-canvas/canvas-and-palette.md "What a template shows off"; blueprint
// template-content.md): stacked where a sequence is the point and one page is looked at at a time, side by side (the
// kind's default) everywhere else. Pure data, merged in by templateCanvasOverrides.
import type { Tab } from '@liveknowledge/document';
import type { TemplateKind } from './templates';

// A carousel is swiped one slide at a time; a group card is opened, cover first, then the inside. The flashcard
// stacks stack by their kind, so they need no entry.
export const STACKED_TEMPLATES: ReadonlySet<TemplateKind> = new Set<TemplateKind>([
  'social-carousel',
  'live-card',
]);

/** The tab's page arrangement a template ships: a stack, or nothing (its pages' kind decides). */
export function templateArrangement(kind: TemplateKind): Partial<Pick<Tab, 'pageArrangement'>> {
  return STACKED_TEMPLATES.has(kind) ? { pageArrangement: 'stack' } : {};
}
