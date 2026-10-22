// Which templates open in Pages on pages of their own (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages"), and on which pages. The builders place their
// elements on exactly these pages; templateCanvasOverrides ships them, so every application path
// (the picker, /new, the MCP worker) lands the pages and the elements together.
import type { Page } from '@livedesign/document';
import { logoDesignPages } from './template-builders-logo';
import { wireframeFlowPages } from './template-builders-wireframe-flows';
import type { TemplateKind } from './templates';

/** The pages a template opens on, or undefined for a template drawn on the open canvas. */
export function templatePages(kind: TemplateKind): Page[] | undefined {
  switch (kind) {
    case 'logo-design':
      return logoDesignPages();
    case 'wireframe-mobile-app':
    case 'wireframe-website':
    case 'wireframe-dashboard':
    case 'wireframe-tablet-app':
    case 'wireframe-watch-app':
      return wireframeFlowPages(kind);
    default:
      return undefined;
  }
}
