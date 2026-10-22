// Page layouts (docs/specs/007-editor/pages-mode.md "Layouts"): ready-made arrangements put onto
// one page, to start from and then edit. A logo page's come from logo-layouts, a wireframe page's
// from wireframe-layouts; layout-catalogue says which a page offers.
import type { LogoLayoutId } from './logo-layouts';
import type { WireframeLayoutId } from './wireframe-layouts';

export type { LayoutBox } from './page-layout-kit';

// Every layout's id: the logo layouts' and the wireframe layouts'.
export type PageLayoutId = LogoLayoutId | WireframeLayoutId;
