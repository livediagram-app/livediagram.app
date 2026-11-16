// Wireframe templates (docs/specs/007-editor/wireframe-pages.md "Templates"): a flow of
// screens, each a wireframe page in its device with one wireframe layout on it
// (wireframe-layouts.ts), named for the screen it is (a browser page's name is its address), in the flow's own
// words ("A flow's own words") and linked so it plays in Prototype mode as it opens ("A flow's links"). Pure: the
// pages are declared once and the elements built on them.
import {
  layOutPages,
  newWireframePage,
  type Element,
  type Page,
  type ScreenLink,
  type WireframeDeviceId,
} from '@livedesign/design';
import { buildPageLayout } from './page-layout-build';
import {
  BACK,
  WIREFRAME_FLOWS,
  type FlowCopy,
  type FlowLinks,
  type WireframeFlow,
  type WireframeFlowKind,
} from './wireframe-flow-data';

export {
  WIREFRAME_FLOWS,
  isWireframeFlowKind,
  type WireframeFlowKind,
} from './wireframe-flow-data';

// The devices whose screens slide in, as a phone's do; a browser's and a laptop's change at once.
export const FLOW_SLIDE_DEVICES: ReadonlySet<WireframeDeviceId> = new Set([
  'iphone',
  'ipad',
  'watch',
]);

// The layouts' stand-in for a product's name, which a flow's brand replaces.
const BRAND_PLACEHOLDER = 'Your App';

/** A flow's page id for its screen at `index` (as wireframeFlowPages names it). */
export const flowPageId = (index: number) => `page-${index + 1}`;

/** A flow's pages: one wireframe page per screen, in its device, named for the screen. */
export function wireframeFlowPages(kind: WireframeFlowKind): Page[] {
  const flow = WIREFRAME_FLOWS[kind];
  return flow.screens.map((s, i) => ({
    ...newWireframePage(flowPageId(i), flow.device),
    name: s.name,
  }));
}

const labelOf = (el: Element): string | undefined => (el as { label?: string }).label;

/** A screen's elements in its flow's words: the copy (the screen's over the flow's), then the brand. */
export function relabelScreen(
  elements: readonly Element[],
  copy: FlowCopy,
  brand: string | undefined,
): Element[] {
  const seen = new Map<string, number>();
  return elements.map((el) => {
    const label = labelOf(el);
    if (label === undefined) return el;
    let next = label;
    if (Object.hasOwn(copy, label)) {
      const words = copy[label]!;
      const n = seen.get(label) ?? 0;
      seen.set(label, n + 1);
      next = typeof words === 'string' ? words : words[Math.min(n, words.length - 1)]!;
    }
    if (brand && next.includes(BRAND_PLACEHOLDER)) next = next.split(BRAND_PLACEHOLDER).join(brand);
    if (next === label) return el;
    // A relabelled element drops any rich-text runs it carried, which would still hold the layout's words.
    const { richText: _runs, ...rest } = el as Element & { richText?: unknown };
    return { ...rest, label: next };
  });
}

/** The element a control names on a screen: the first, in build order, with its words or its icon. */
export function findControl(elements: readonly Element[], control: string): number {
  if (control.startsWith('icon:')) {
    const iconId = control.slice('icon:'.length);
    return elements.findIndex(
      (el) => el.type === 'shape' && el.shape === 'icon' && el.iconId === iconId,
    );
  }
  return elements.findIndex((el) => labelOf(el) === control);
}

/** A screen's elements with its controls linked: to a screen of the flow by name, or back. */
export function linkScreen(
  elements: readonly Element[],
  links: FlowLinks,
  flow: WireframeFlow,
  self: number,
): Element[] {
  const out = [...elements];
  const slide = FLOW_SLIDE_DEVICES.has(flow.device);
  for (const [control, target] of Object.entries(links)) {
    const to = flow.screens.findIndex((s) => s.name === target);
    // A link to its own screen goes nowhere (a flow-wide nav entry on the screen it names).
    if (to === self) continue;
    if (target !== BACK && to < 0) continue;
    const at = findControl(out, control);
    if (at < 0) continue;
    const link: ScreenLink =
      target === BACK ? { kind: 'back' } : { kind: 'page', pageId: flowPageId(to) };
    out[at] = { ...out[at]!, link: slide ? { ...link, transition: 'slide' } : link };
  }
  return out;
}

/** A flow's elements screen by screen: each screen's layout on its page, in the flow's words, linked. */
export function buildWireframeFlowScreens(kind: WireframeFlowKind): Element[][] {
  const flow = WIREFRAME_FLOWS[kind];
  return layOutPages(wireframeFlowPages(kind)).map((page, i) => {
    const screen = flow.screens[i]!;
    const built = buildPageLayout(screen.layout, page);
    const worded = relabelScreen(built, { ...flow.copy, ...screen.copy }, flow.brand);
    return linkScreen(worded, { ...flow.links, ...screen.links }, flow, i);
  });
}

/** A flow's elements: every screen's, in page order. */
export function buildWireframeFlow(kind: WireframeFlowKind): Element[] {
  return buildWireframeFlowScreens(kind).flat();
}
