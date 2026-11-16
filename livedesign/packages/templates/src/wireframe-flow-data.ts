// The wireframe flows' data (docs/specs/007-editor/wireframe-pages.md "Templates"): every flow, gathered from the
// app flows (a phone, tablet or watch) and the web flows (a browser or laptop). Pure data, so the template previews
// can read it (the `./template-flow-data` export) without pulling the layout builders into a page's bundle.
import type { TemplateKind } from './templates';
import type { WireframeFlow, WireframeFlowKind } from './wireframe-flow-kit';
import { APP_FLOWS } from './wireframe-flows-apps';
import { WEB_FLOWS } from './wireframe-flows-web';

export {
  BACK,
  type FlowCopy,
  type FlowLinks,
  type FlowScreen,
  type WireframeFlow,
  type WireframeFlowKind,
} from './wireframe-flow-kit';

export const WIREFRAME_FLOWS = { ...APP_FLOWS, ...WEB_FLOWS } as Record<
  WireframeFlowKind,
  WireframeFlow
>;

/** True for a template that is a wireframe flow. */
export function isWireframeFlowKind(kind: TemplateKind): kind is WireframeFlowKind {
  return Object.hasOwn(WIREFRAME_FLOWS, kind);
}
