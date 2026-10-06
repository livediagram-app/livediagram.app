// Template tabs for the authoring paths outside the editor (docs/specs/015-api/mcp-server.md §4.5,
// docs/specs/024-agents/edit-operations.md): the MCP's `template` argument and a changeset's
// `replace` body. Here rather than in @livediagram/document because the catalogue lives here and
// this package already imports the document one (the reverse would be a cycle).

import { buildTab, stampTabKind, type Tab } from '@livediagram/document';
import { buildTemplate, templateTabs } from './build-template';
import { TEMPLATES, isTemplateKind, templateCanvasOverrides, type TemplateKind } from './templates';

// A template argument resolved against the catalogue; null for an unknown kind, so the caller can
// answer with the valid kinds and the model corrects itself without another round trip.
export function resolveTemplate(kind: string): TemplateKind | null {
  return isTemplateKind(kind) ? kind : null;
}

export const validTemplateKinds = () => TEMPLATES.map((t) => t.kind).join(', ');

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

// Every tab a template makes (docs/specs/026-plan/plan-templates.md "How a template with tabs is made"):
// the first takes `first`'s id and name, the rest a fresh id each and the template's names. A template of
// one tab makes exactly buildTemplateTab's.
export function buildTemplateTabs(
  first: { id: string; name: string },
  kind: TemplateKind,
  newId: () => string,
  themeId?: string,
): Tab[] {
  return templateTabs(kind).map((def, i) =>
    stampTabKind({
      ...buildTab(
        i === 0 ? first.id : newId(),
        i === 0 ? first.name : (def.name ?? first.name),
        def.build(0, 0),
        'preserve',
        themeId,
      ),
      templateChosen: true,
      ...templateCanvasOverrides(kind),
    }),
  );
}
