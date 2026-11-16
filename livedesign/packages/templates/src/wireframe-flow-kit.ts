// The wireframe flows' kit (docs/specs/007-editor/wireframe-pages.md "Templates"): the shape of a flow (its device,
// its screens, each a named wireframe layout in the flow's own words, linked so the flow plays in Prototype mode as
// it opens) and the helpers the flows' data is written with. Type-only imports, so the previews can read it.
import type { WireframeDeviceId } from '@livedesign/design';
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
  | 'wireframe-launch-site'
  | 'wireframe-account-settings'
  | 'wireframe-class-booking'
>;

// A screen's words in its flow ("A flow's own words"): a layout's label to the flow's own; a list gives each element
// so labelled its entry in turn, the rest keeping the last.
export type FlowCopy = Readonly<Record<string, string | readonly string[]>>;

// A screen's links ("A flow's links"): a control, by its words (after the copy and brand) or `icon:<iconId>`, to the
// screen it goes to by name, or BACK.
export type FlowLinks = Readonly<Record<string, string>>;

export type FlowScreen = {
  name: string;
  layout: WireframeLayoutId;
  copy?: FlowCopy;
  links?: FlowLinks;
};

export type WireframeFlow = {
  device: WireframeDeviceId;
  // The product's name, in place of the layouts' "Your App".
  brand?: string;
  // Words and links for every screen, under each screen's own.
  copy?: FlowCopy;
  links?: FlowLinks;
  screens: readonly FlowScreen[];
};

/** The target that makes a control a back link. */
export const BACK = 'back';

// The back arrow most phone layouts draw at the top left.
export const BACK_ARROW = { 'icon:arrow-left': BACK } as const;

// A shop's search results (wf-search-results) in a flow's own words: the row titles, lines and prices in order.
const RESULT_TITLES = [
  'Linen Shirt',
  'Canvas Tote',
  'Wool Scarf',
  'Leather Belt',
  'Cotton Cap',
  'Field Jacket',
  'Knit Beanie',
] as const;
const RESULT_PRICES = [
  '$24.00',
  '$30.00',
  '$36.00',
  '$42.00',
  '$48.00',
  '$54.00',
  '$60.00',
] as const;
export function results(
  titles: readonly string[],
  lines: readonly string[],
  prices: readonly string[],
): Record<string, string | readonly string[]> {
  const copy: Record<string, string | readonly string[]> = {
    'In stock · Ships tomorrow': lines,
  };
  RESULT_TITLES.forEach((t, i) => (copy[t] = titles[i]!));
  RESULT_PRICES.forEach((p, i) => (copy[p] = prices[i]!));
  return copy;
}
