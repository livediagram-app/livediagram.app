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
} from '@livedesign/design';
import { buildPageLayout } from './page-layout-build';
import type { TemplateKind } from './templates';
import type { WireframeLayoutId } from './wireframe-layouts';

export type WireframeFlowKind = Extract<
  TemplateKind,
  | 'wireframe-mobile-app'
  | 'wireframe-website'
  | 'wireframe-dashboard'
  | 'wireframe-tablet-app'
  | 'wireframe-watch-app'
  | 'wireframe-social-app'
  | 'wireframe-delivery-app'
  | 'wireframe-travel-app'
  | 'wireframe-ride-app'
  | 'wireframe-music-app'
  | 'wireframe-app-onboarding'
  | 'wireframe-online-store'
  | 'wireframe-blog'
  | 'wireframe-company-site'
  | 'wireframe-project-tool'
  | 'wireframe-team-inbox'
  | 'wireframe-video-app'
  | 'wireframe-fitness-watch'
  | 'wireframe-watch-music'
>;

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
  // A social app: the feed and stories, a post and making one, what is new and who you are.
  'wireframe-social-app': {
    device: 'iphone',
    screens: [
      { name: 'Feed', layout: 'wf-home-feed' },
      { name: 'Stories', layout: 'wf-stories' },
      { name: 'Post', layout: 'wf-post-detail' },
      { name: 'New Post', layout: 'wf-compose-post' },
      { name: 'Notifications', layout: 'wf-notifications' },
      { name: 'Profile', layout: 'wf-profile' },
    ],
  },
  // A delivery app from browsing the shop to watching the order arrive.
  'wireframe-delivery-app': {
    device: 'iphone',
    screens: [
      { name: 'Shop', layout: 'wf-shop-grid' },
      { name: 'Search', layout: 'wf-search-results' },
      { name: 'Item', layout: 'wf-product-detail' },
      { name: 'Cart', layout: 'wf-cart' },
      { name: 'Tracking', layout: 'wf-order-tracking' },
    ],
  },
  // A travel app: find a flight, pick one, board it, then explore where you land.
  'wireframe-travel-app': {
    device: 'iphone',
    screens: [
      { name: 'Search', layout: 'wf-flight-search' },
      { name: 'Results', layout: 'wf-search-results' },
      { name: 'Boarding Pass', layout: 'wf-boarding-pass' },
      { name: 'Explore', layout: 'wf-places' },
    ],
  },
  // A ride app: sign in, say where to, watch the ride come, read its updates.
  'wireframe-ride-app': {
    device: 'iphone',
    screens: [
      { name: 'Sign In', layout: 'wf-sign-in' },
      { name: 'Where To', layout: 'wf-places' },
      { name: 'Your Ride', layout: 'wf-ride' },
      { name: 'Updates', layout: 'wf-notifications' },
    ],
  },
  // A music app: browse and search, then listen.
  'wireframe-music-app': {
    device: 'iphone',
    screens: [
      { name: 'Browse', layout: 'wf-gallery' },
      { name: 'Search', layout: 'wf-search-results' },
      { name: 'Now Playing', layout: 'wf-music-player' },
      { name: 'Podcast', layout: 'wf-podcast' },
    ],
  },
  // An app's first run, from the welcome to the empty first screen.
  'wireframe-app-onboarding': {
    device: 'iphone',
    screens: [
      { name: 'Welcome', layout: 'wf-onboarding' },
      { name: 'Sign Up', layout: 'wf-sign-up' },
      { name: 'Verify', layout: 'wf-verify-code' },
      { name: 'Permissions', layout: 'wf-permissions' },
      { name: 'Get Started', layout: 'wf-empty-state' },
    ],
  },
  // An online store in the browser, from the shop to paying.
  'wireframe-online-store': {
    device: 'browser',
    screens: [
      { name: 'Shop', layout: 'wf-shop-grid' },
      { name: 'Product', layout: 'wf-product-detail' },
      { name: 'Cart', layout: 'wf-cart' },
      { name: 'Checkout', layout: 'wf-checkout' },
    ],
  },
  // A blog: the posts, one to read, and a way to get in touch.
  'wireframe-blog': {
    device: 'browser',
    screens: [
      { name: 'Blog', layout: 'wf-blog' },
      { name: 'Article', layout: 'wf-article' },
      { name: 'Contact', layout: 'wf-contact' },
    ],
  },
  // A company's site: home, the people, help and contact.
  'wireframe-company-site': {
    device: 'browser',
    screens: [
      { name: 'Home', layout: 'wf-landing-page' },
      { name: 'Team', layout: 'wf-team' },
      { name: 'Help', layout: 'wf-help-center' },
      { name: 'Contact', layout: 'wf-contact' },
    ],
  },
  // A project tool's working screens on a laptop.
  'wireframe-project-tool': {
    device: 'laptop',
    screens: [
      { name: 'Board', layout: 'wf-kanban' },
      { name: 'Tasks', layout: 'wf-task-list' },
      { name: 'Calendar', layout: 'wf-calendar' },
      { name: 'Team', layout: 'wf-team' },
    ],
  },
  // A team inbox's working screens on a laptop.
  'wireframe-team-inbox': {
    device: 'laptop',
    screens: [
      { name: 'Inbox', layout: 'wf-inbox' },
      { name: 'Conversation', layout: 'wf-chat' },
      { name: 'Notifications', layout: 'wf-notifications' },
      { name: 'Settings', layout: 'wf-settings' },
    ],
  },
  // A video app on a tablet: find something, then watch it.
  'wireframe-video-app': {
    device: 'ipad',
    screens: [
      { name: 'Browse', layout: 'wf-gallery' },
      { name: 'Search', layout: 'wf-search-results' },
      { name: 'Watch', layout: 'wf-video-player' },
      { name: 'Profile', layout: 'wf-profile' },
    ],
  },
  // A fitness app on the wrist.
  'wireframe-fitness-watch': {
    device: 'watch',
    screens: [
      { name: 'Workout', layout: 'wf-watch-workout' },
      { name: 'Heart Rate', layout: 'wf-watch-heart-rate' },
      { name: 'Timer', layout: 'wf-watch-timer' },
      { name: 'Weather', layout: 'wf-watch-weather' },
    ],
  },
  // A music remote on the wrist.
  'wireframe-watch-music': {
    device: 'watch',
    screens: [
      { name: 'Now Playing', layout: 'wf-watch-now-playing' },
      { name: 'Up Next', layout: 'wf-watch-up-next' },
    ],
  },
};

/** True for a template that is a wireframe flow. */
export function isWireframeFlowKind(kind: TemplateKind): kind is WireframeFlowKind {
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
