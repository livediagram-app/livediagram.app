// Wireframe templates (docs/specs/007-editor/wireframe-pages.md "Templates"): a flow of
// screens, each a wireframe page in its device with one wireframe layout on it
// (wireframe-layouts.ts), named for the screen it is (a browser page's name is its address). Pure:
// the pages are declared once and the elements built on them.
import {
  layOutPages,
  newWireframePage,
  type Element,
  type Page,
  type WireframeDeviceId,
} from '@livepages/document';
import { buildPageLayout } from './page-layout-build';
import type { WireframeLayoutId } from './wireframe-layouts';

export type WireframeFlowKind =
  | 'wireframe-mobile-app'
  | 'wireframe-website'
  | 'wireframe-dashboard'
  | 'wireframe-tablet-app'
  | 'wireframe-watch-app';

type WireframeFlow = {
  device: WireframeDeviceId;
  screens: readonly { name: string; layout: WireframeLayoutId }[];
};

export const WIREFRAME_FLOWS: Record<WireframeFlowKind, WireframeFlow> = {
  // A shopping app from first open to paying: the happy path a mobile flow is reviewed on.
  'wireframe-mobile-app': {
    device: 'iphone',
    screens: [
      { name: 'Onboarding', layout: 'wf-onboarding' },
      { name: 'Sign In', layout: 'wf-sign-in' },
      { name: 'Home', layout: 'wf-home-feed' },
      { name: 'Product', layout: 'wf-product-detail' },
      { name: 'Checkout', layout: 'wf-checkout' },
    ],
  },
  // A marketing site: the landing page, pricing and the way in.
  'wireframe-website': {
    device: 'browser',
    screens: [
      { name: 'Home', layout: 'wf-landing-page' },
      { name: 'Pricing', layout: 'wf-pricing' },
      { name: 'Sign In', layout: 'wf-sign-in' },
    ],
  },
  // A web app's working screens on a laptop.
  'wireframe-dashboard': {
    device: 'laptop',
    screens: [
      { name: 'Overview', layout: 'wf-dashboard' },
      { name: 'Orders', layout: 'wf-data-table' },
      { name: 'Settings', layout: 'wf-settings' },
    ],
  },
  // A tablet app's three main screens.
  'wireframe-tablet-app': {
    device: 'ipad',
    screens: [
      { name: 'Discover', layout: 'wf-home-feed' },
      { name: 'Messages', layout: 'wf-chat' },
      { name: 'Profile', layout: 'wf-profile' },
    ],
  },
  // A watch app's glance, list and alert.
  'wireframe-watch-app': {
    device: 'watch',
    screens: [
      { name: 'Glance', layout: 'wf-watch-glance' },
      { name: 'Today', layout: 'wf-watch-list' },
      { name: 'Alert', layout: 'wf-watch-notification' },
    ],
  },
};

export function isWireframeFlow(kind: string): kind is WireframeFlowKind {
  return Object.hasOwn(WIREFRAME_FLOWS, kind);
}

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
