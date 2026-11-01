// Which templates open in Pages on pages of their own (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages"), and on which pages. The builders place their
// elements on exactly these pages; templateCanvasOverrides ships them, so every application path
// (the picker, /new, the MCP worker) lands the pages and the elements together.
import type { Page } from '@livedesign/design';
import { logoDesignPages } from './template-builders-logo';
import { isWireframeFlowKind, wireframeFlowPages } from './template-builders-wireframe-flows';
import { isLogoExplorationKind, logoExplorationPages } from './template-builders-logo-explorations';
import type { TemplateKind } from './templates';

/** The pages a template opens on, or undefined for a template drawn on the open canvas. */
export function templatePages(kind: TemplateKind): Page[] | undefined {
  if (isWireframeFlowKind(kind)) return wireframeFlowPages(kind);
  if (isLogoExplorationKind(kind)) return logoExplorationPages(kind);
  switch (kind) {
    case 'logo-design':
      return logoDesignPages();
    default:
      return undefined;
  }
}
