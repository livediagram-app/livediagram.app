// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/008-canvas/canvas-and-palette.md for the picker UX; the editor applies its theme recolour on
// top (apps/live/lib/template-builders.ts), and the MCP worker
// materialises these directly (docs/specs/015-api/mcp-server.md §4.5).

import { buildWireframeFlow } from './template-builders-wireframe-flows';
import { settleChips, type Element } from '@livedesign/document';
import type { TemplateKind } from './templates';
import { buildLogoDesign } from './template-builders-logo';

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
// The output lands settled (docs/specs/009-elements/blueprints/badge.md "Settling"): a builder sizes a step
// after making it, so its number is set to half the disc here, as a stored board reads back, and a
// preview or an agent's create shows what the editor will.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  return settleChips([], buildUnsettled(kind, cx, cy), { attachLoose: false });
}

function buildUnsettled(kind: TemplateKind, cx: number, cy: number): Element[] {
  switch (kind) {
    // Blank Tab is truly blank: no seeded element.
    case 'blank':
      return [];
    case 'logo-design':
      return buildLogoDesign(cx, cy);
    // A blank illustration is its one empty page, which asks what it is for, and a blank of a page kind its one
    // empty page of that kind (blank-page-templates.ts).
    case 'blank-illustration':
    case 'blank-logo':
    case 'blank-wireframe-phone':
    case 'blank-wireframe-tablet':
    case 'blank-wireframe-browser':
    case 'blank-wireframe-laptop':
    case 'blank-wireframe-watch':
      return [];
    case 'wireframe-mobile-app':
    case 'wireframe-website':
    case 'wireframe-dashboard':
    case 'wireframe-tablet-app':
    case 'wireframe-watch-app':
      return buildWireframeFlow(kind);
  }
}

// A template's tabs: every Pages template
// makes one, named null so it keeps the name the caller gives a new tab. The shape stays a list so the callers that
// make a template's tabs (the editor, the api, the MCP worker) need not change. Its elements are buildTemplate's.
export type TemplateTabDef = {
  name: string | null;
  build: (cx: number, cy: number) => Element[];
};

export function templateTabs(kind: TemplateKind): TemplateTabDef[] {
  return [{ name: null, build: (cx: number, cy: number) => buildTemplate(kind, cx, cy) }];
}
