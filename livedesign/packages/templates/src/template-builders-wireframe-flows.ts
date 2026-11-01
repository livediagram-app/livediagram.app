// Wireframe templates (docs/specs/007-editor/wireframe-pages.md "Templates"): a flow of
// screens, each a wireframe page in its device with one wireframe layout on it
// (wireframe-layouts.ts), named for the screen it is (a browser page's name is its address). Pure:
// the pages are declared once and the elements built on them.
import { layOutPages, newWireframePage, type Element, type Page } from '@livedesign/design';
import { buildPageLayout } from './page-layout-build';
import { WIREFRAME_FLOWS, type WireframeFlowKind } from './wireframe-flow-data';

export {
  WIREFRAME_FLOWS,
  isWireframeFlowKind,
  type WireframeFlowKind,
} from './wireframe-flow-data';

/** A flow's pages: one wireframe page per screen, in its device, named for the screen. */
export function wireframeFlowPages(kind: WireframeFlowKind): Page[] {
  const flow = WIREFRAME_FLOWS[kind];
  return flow.screens.map((s, i) => ({
    ...newWireframePage(`page-${i + 1}`, flow.device),
    name: s.name,
  }));
}

/** A flow's elements: each screen's layout on its page. */
export function buildWireframeFlow(kind: WireframeFlowKind): Element[] {
  const flow = WIREFRAME_FLOWS[kind];
  return layOutPages(wireframeFlowPages(kind)).flatMap((page, i) =>
    buildPageLayout(flow.screens[i]!.layout, page),
  );
}
