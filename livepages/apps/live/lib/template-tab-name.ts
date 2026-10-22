// The name a template gives the tab it fills (docs/specs/007-editor/templates-by-mode.md "The tab's name"), from the
// Quick Start and /new alike: a Board template's board title, else the template's title, whatever the tab was called
// before. A blank template gives none, so the tab keeps its name.
import type { Element } from '@livepages/document';
import { TEMPLATES, isBlankTemplate, type TemplateKind } from '@livepages/templates';

export function templateTabName(
  kind: TemplateKind,
  first: { name: string; elements: readonly Element[]; kind?: string | undefined },
): string | null {
  if (isBlankTemplate(kind)) return null;
  const title = TEMPLATES.find((t) => t.kind === kind)?.title;
  if (!title) return null;
  // Read off the board itself, never through the tab's own name (a named tab still takes the board's title). A
  // Sheet's title lives in the sheet store, not on its element, and a Sheet template's is its title, so the
  // template's title serves.
  return (first.kind === 'board' && boardTitle(first.elements)) || title;
}

function boardTitle(elements: readonly Element[]): string | null {
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    const t = el.planBoard?.title.trim();
    if (t) return t;
  }
  return null;
}
