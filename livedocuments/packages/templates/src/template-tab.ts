// Template tabs for the authoring paths outside the editor (docs/specs/015-api/mcp-server.md §4.5,
// docs/specs/024-agents/edit-operations.md): the MCP's `template` argument and a changeset's
// `replace` body. Here rather than in @livedocuments/document because the catalogue lives here and
// this package already imports the document one (the reverse would be a cycle).

import { buildTab, getBuiltInTheme, type Tab } from '@livedocuments/document';
import { withBlankPageThemed } from './blank-page-templates';
import { buildTemplate, templateTabs } from './build-template';
import { TEMPLATES, templateKindOf, type TemplateKind } from './templates';
import { templateCanvasOverrides } from './template-canvas-overrides';

// The templates an agent may build: the catalogue's (templateCatalogue).
const AGENT_TEMPLATES = TEMPLATES.filter((t) => !t.hidden);
const AGENT_KINDS: ReadonlySet<string> = new Set(AGENT_TEMPLATES.map((t) => t.kind));

// A template argument resolved against the catalogue; null for an unknown kind, so the
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
 * word starting with a word of it (of 3 letters or more), so "slide" offers the slide decks.
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

/** "Closest: slide-deck, blank-slide-deck. " for an unknown kind with any, else nothing. */
export function closestTemplatesHint(given: string): string {
  const closest = closestTemplateKinds(given);
  return closest.length ? `Closest: ${closest.join(', ')}. ` : '';
}

// A template tab: the curated scaffold at its hand-tuned coordinates (layout deliberately NOT run,
// that is the point of a template), themed by buildTab like any other elements, plus the template's
// canvas overrides and the templateChosen flag the editor's Quick Start reads, so a tab minted here is
// indistinguishable from one the editor commits.
export function buildTemplateTab(
  tabId: string,
  name: string,
  kind: TemplateKind,
  themeId?: string,
): Tab {
  return withBlankPageThemed(
    {
      ...buildTab(tabId, name, buildTemplate(kind, 0, 0), 'preserve', themeId),
      templateChosen: true,
      ...templateCanvasOverrides(kind),
    },
    kind,
    getBuiltInTheme(themeId),
  );
}

// Every tab a template makes: the first takes `first`'s id and name, the rest a fresh id each and the template's
// names. A template of one tab makes exactly buildTemplateTab's.
// The name a template's first tab takes where an agent or the api makes it: the name given, unless it is one of the
// template's later tabs (the agent naming the tab it wanted, which the template makes anyway), when the first keeps its
// template name, so no two tabs share one. With no name given, the template's own first name, else Tab 1.
export function templateTabName(given: string | undefined, kind: TemplateKind): string {
  const [first, ...later] = templateTabs(kind).map((d) => d.name);
  if (given === undefined || !given.trim()) return first ?? 'Tab 1';
  const key = given.trim().toLowerCase();
  return first && later.some((n) => n?.trim().toLowerCase() === key) ? first : given;
}

export function buildTemplateTabs(
  first: { id: string; name: string },
  kind: TemplateKind,
  newId: () => string,
  themeId?: string,
): Tab[] {
  const defs = templateTabs(kind);
  const ids = defs.map((_, i) => (i === 0 ? first.id : newId()));
  return defs.map((def, i) =>
    withBlankPageThemed(
      {
        ...buildTab(
          ids[i]!,
          i === 0 ? first.name : (def.name ?? first.name),
          def.build(0, 0),
          'preserve',
          themeId,
        ),
        templateChosen: true,
        ...templateCanvasOverrides(kind),
      },
      kind,
      getBuiltInTheme(themeId),
    ),
  );
}
