// Popular under a mode filter (docs/specs/007-editor/templates-by-mode.md "The mode filter"): Popular's own
// templates of that mode (its blank first), topped up from the mode's best so it never shows fewer than
// POPULAR_PER_MODE. Everything keeps Popular as the catalogue lists it. Shared by the editor's template
// step and the marketing gallery, so the two shelves can never disagree.
import type { EditorMode } from '@livediagram/document';
import { templateEditorMode } from './template-modes';
import { POPULAR_TEMPLATE_KINDS, TEMPLATES, type TemplateKind } from './templates';

export const POPULAR_PER_MODE = 5;

export const MODE_BEST: Readonly<Record<EditorMode, readonly TemplateKind[]>> = {
  diagram: ['swot', 'timeline', 'flowchart'],
  draw: ['journey-doodle', 'comic-strip', 'idea-garden', 'rich-picture'],
  illustrate: ['event-poster', 'year-in-review', 'social-carousel', 'data-story'],
  plan: ['project-planner', 'kanban', 'team-retro', 'bug-triage'],
  facilitate: ['retrospective', 'town-hall', 'lean-coffee', 'crazy-eights'],
};

const LISTED = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));

export function popularKindsFor(choice: 'all' | EditorMode): TemplateKind[] {
  const popular = POPULAR_TEMPLATE_KINDS.filter(
    (k) => LISTED.has(k) && (choice === 'all' || templateEditorMode(k) === choice),
  );
  if (choice === 'all' || popular.length >= POPULAR_PER_MODE) return popular;
  const extra = MODE_BEST[choice].filter(
    (k) => LISTED.has(k) && !popular.includes(k) && templateEditorMode(k) === choice,
  );
  return [...popular, ...extra].slice(0, Math.max(POPULAR_PER_MODE, popular.length));
}
