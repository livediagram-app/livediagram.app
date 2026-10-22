// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/026-plan/plan-templates.md for the picker UX; the editor applies its theme recolour on
// top (apps/editor/lib/template-builders.ts), and the MCP worker
// materialises these directly (docs/specs/015-api/mcp-server.md §4.5).

import { isFormTemplateKind } from './form-templates';
import { settleChips, type Element, type Tab } from '@liveplanner/project';
import type { TemplateKind } from './templates';
import { buildPlanTemplate, isPlanTemplateKind, planTemplateTabs } from './template-builders-plan';

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
// The output lands settled (docs/specs/009-elements/blueprints/badge.md "Settling"): a builder sizes a step
// after making it, so its number is set to half the disc here, as a stored board reads back, and a
// preview or an agent's create shows what the editor will.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  return settleChips([], buildUnsettled(kind, cx, cy), { attachLoose: false });
}

function buildUnsettled(kind: TemplateKind, cx: number, cy: number): Element[] {
  // A form template's tab starts empty: the editor starts the form on it (form-templates.ts).
  if (isFormTemplateKind(kind)) return [];
  // A blank tab starts empty, as Start Planning's empty state (docs/specs/026-plan/plan-mode.md).
  if (kind === 'blank') return [];
  return buildPlanTemplate(kind, cx, cy);
}

// A template's tabs (docs/specs/026-plan/plan-templates.md "How a template with tabs is made"): every Plan
// template but Blank Plan makes several, named; every other template makes one, named null so it keeps
// the name the caller gives a new tab. The first tab's elements are always buildTemplate's.
export type TemplateTabDef = {
  name: string | null;
  build: (cx: number, cy: number) => Element[];
  // The tab's own fields, given every tab's id in order: a Plan template's kind and Dashboard
  // (docs/specs/026-plan/plan-tabs.md "Templates").
  tab?: (ids: readonly string[]) => Partial<Tab>;
};

export function templateTabs(kind: TemplateKind): TemplateTabDef[] {
  if (isPlanTemplateKind(kind)) return planTemplateTabs(kind);
  return [{ name: null, build: (cx: number, cy: number) => buildTemplate(kind, cx, cy) }];
}
