// Template tabs for the authoring paths outside the editor (docs/specs/015-api/mcp-server.md §4.5,
// docs/specs/024-agents/edit-operations.md): the MCP's `template` argument and a changeset's
// `replace` body. Here rather than in @livediagram/document because the catalogue lives here and
// this package already imports the document one (the reverse would be a cycle).

import { buildTab, stampTabKind, type Tab } from '@livediagram/document';
import { buildTemplate } from './build-template';
import { TEMPLATES, templateKindOf, type TemplateKind } from './templates';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { isBlankTemplate } from './template-modes';

// The templates an agent may build: the catalogue's (templateCatalogue), never a hidden one.
const AGENT_TEMPLATES = TEMPLATES.filter((t) => !t.hidden);
const AGENT_KINDS: ReadonlySet<string> = new Set(AGENT_TEMPLATES.map((t) => t.kind));

// A template argument resolved against the catalogue; null for an unknown kind (or one only the editor makes), so the
// caller can answer with the valid kinds and the model corrects itself without another round trip.
export function resolveTemplate(kind: string): TemplateKind | null {
  const resolved = templateKindOf(kind);
  return resolved && AGENT_KINDS.has(resolved) ? resolved : null;
}

export const validTemplateKinds = () => AGENT_TEMPLATES.map((t) => t.kind).join(', ');

// At most this many kinds a refusal offers as close to an unknown one.
export const CLOSEST_TEMPLATES_MAX = 5;

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * The kinds an unknown one most likely meant (docs/specs/015-api/mcp-server.md §4.5): those whose kind or title has a
 * word starting with a word of it (of 3 letters or more), so "retro" offers the three retrospectives named for it.
 */
export function closestTemplateKinds(given: string): TemplateKind[] {
  const asked = wordsOf(given).filter((w) => w.length >= 3);
  if (asked.length === 0) return [];
  return AGENT_TEMPLATES.filter((t) =>
    [...wordsOf(t.kind), ...wordsOf(t.title)].some((w) => asked.some((a) => w.startsWith(a))),
  )
    .slice(0, CLOSEST_TEMPLATES_MAX)
    .map((t) => t.kind);
}

/** "Closest: retrospective, start-stop-continue. " for an unknown kind with any, else nothing. */
export function closestTemplatesHint(given: string): string {
  const closest = closestTemplateKinds(given);
  return closest.length ? `Closest: ${closest.join(', ')}. ` : '';
}

// A template tab: the curated scaffold at its hand-tuned coordinates (layout deliberately NOT run,
// that is the point of a template), themed by buildTab like any other elements, plus the template's
// canvas overrides and the templateChosen flag the editor's Quick Start reads. stampTabKind fills
// the ordinary 'diagram' for every template without a tab kind of its own
// (docs/specs/021-event-storming/event-storming.md), so a tab minted here is indistinguishable from
// one the editor commits.
export function buildTemplateTab(
  tabId: string,
  name: string,
  kind: TemplateKind,
  themeId?: string,
): Tab {
  return stampTabKind({
    ...buildTab(tabId, name, buildTemplate(kind, 0, 0), 'preserve', themeId),
    templateChosen: true,
    ...templateCanvasOverrides(kind),
  });
}

// The name a template gives the tab it fills (docs/specs/007-editor/templates-by-mode.md "The tab's name"): the
// template's title, whether the editor's Quick Start and /new or an agent fills it. A blank template gives none, so
// the tab keeps (or takes) its own name.
export function templateTabName(kind: TemplateKind): string | null {
  if (isBlankTemplate(kind)) return null;
  return TEMPLATES.find((t) => t.kind === kind)?.title ?? null;
}
