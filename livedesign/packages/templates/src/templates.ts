import { titleCase } from '@livedesign/api-schema';
import { UNTITLED_DESIGN_NAME, isUntitledDesignName } from './legacy-untitled';

// The Pages templates (docs/specs/008-canvas/canvas-and-palette.md "Templates"): every template opens in Pages,
// on pages of its own.
export type TemplateKind =
  // Blank Tab: an empty tab, made by name (an agent's add_tab, a `/new?blank` link); in no category.
  | 'blank'
  // Blank Illustration (docs/specs/008-canvas/canvas-and-palette.md "Templates"): one empty page, which asks what
  // it is for. A quick-pick, never inside a category grid.
  | 'blank-illustration'
  // The blanks of a page kind (docs/specs/007-editor/start-diagramming.md "Recommended and groups"): one empty
  // page whose kind is already chosen (blank-page-templates.ts), so it never asks what it is for.
  | 'blank-logo'
  | 'blank-wireframe-phone'
  | 'blank-wireframe-tablet'
  | 'blank-wireframe-browser'
  | 'blank-wireframe-laptop'
  | 'blank-wireframe-watch'
  // One unstarted photo page (docs/specs/031-photo/photo-pages.md "Making a photo page").
  | 'photo-edit'
  // Logo-design exploration: six labelled artboards (horizontal / stacked lockups with and without a tagline, the
  // mark as an app icon, a one-colour version) plus the brand palette, so a designer picks the composition that
  // fits, deletes the rest, and iterates.
  | 'logo-design'
  // Logo explorations (docs/specs/007-editor/logo-pages.md "Logo layouts"): one logo page per layout of a family.
  | 'logo-lockups'
  | 'logo-wordmarks'
  | 'logo-emblems'
  | 'logo-marks'
  // Wireframe templates (docs/specs/007-editor/wireframe-pages.md "Templates"): flows of wireframe pages,
  // each screen a wireframe layout in its device.
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
  | 'wireframe-watch-music';

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
  // Catalogue metadata only: nothing gates on it. The picker browses by category
  // (docs/specs/008-canvas/canvas-and-palette.md), so every template is reachable and this flag decides nothing about
  // what a user sees.
  extra?: boolean;
  // True for templates that never appear in listings (the picker's browse grids + search, the MCP list_templates
  // catalogue) but stay buildable via buildTemplate, for a dedicated entry point that names the kind directly.
  // NO template sets it today; the listing paths still filter on it, so the next such entry point is a one-word
  // change rather than a new concept.
  hidden?: boolean;
};

export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank Tab',
    description: 'An empty tab: one page that asks what it is for.',
  },
  {
    kind: 'blank-illustration',
    title: 'Blank Illustration',
    description: 'An empty page that becomes a logo or a wireframe.',
    extra: true,
  },
  {
    kind: 'blank-logo',
    title: 'Blank Logo',
    description: 'One empty square artboard for a mark, a wordmark or a lockup.',
    extra: true,
  },
  {
    // docs/specs/031-photo/photo-pages.md "Making a photo page" Templates.
    kind: 'photo-edit',
    title: 'Photo Edit',
    description:
      'One photo page to start: open a picture or make a blank one, then edit it with layers, brushes, adjustments and filters.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-phone',
    title: 'Blank Phone Wireframe',
    description: 'One empty iPhone screen to wireframe a mobile app on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-tablet',
    title: 'Blank Tablet Wireframe',
    description: 'One empty iPad screen to wireframe a tablet app on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-browser',
    title: 'Blank Website Wireframe',
    description: 'One empty browser window to wireframe a web page on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-laptop',
    title: 'Blank Laptop Wireframe',
    description: 'One empty laptop screen to wireframe a web or desktop app on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-watch',
    title: 'Blank Watch Wireframe',
    description: 'One empty watch face to wireframe a watch app on.',
    extra: true,
  },
  {
    kind: 'logo-design',
    title: 'Logo Design',
    description:
      'A brand exploration on Square pages: six lockups (horizontal, stacked, app icon, one colour), each on its own artboard, plus a palette page. Pick one, delete the rest, swap in your own mark.',
    extra: true,
  },
  {
    kind: 'wireframe-mobile-app',
    title: 'Mobile App Wireframe',
    description:
      'Five iPhone screens of a shopping app, from onboarding and sign in to the home feed, a product and checkout.',
    extra: true,
  },
  {
    kind: 'wireframe-website',
    title: 'Website Wireframe',
    description: 'Three browser pages of a product site: a landing page, pricing and sign in.',
    extra: true,
  },
  {
    kind: 'wireframe-dashboard',
    title: 'Web App Wireframe',
    description:
      'Three laptop screens of a web app: an overview dashboard, an orders table and settings.',
    extra: true,
  },
  {
    kind: 'wireframe-tablet-app',
    title: 'Tablet App Wireframe',
    description: 'Three iPad screens: a discovery feed, messages and a profile.',
    extra: true,
  },
  {
    kind: 'wireframe-watch-app',
    title: 'Watch App Wireframe',
    description: 'Three watch faces: a glance, a list and a notification.',
    extra: true,
  },
  {
    kind: 'logo-lockups',
    title: 'Lockup Explorations',
    description:
      'Seven logo pages of a mark with its name: above, beside, stacked, to the right, divided, in a pill and below.',
    extra: true,
  },
  {
    kind: 'logo-wordmarks',
    title: 'Wordmark Explorations',
    description:
      'Six logo pages of type-led logos: a wordmark, a monogram, underlined, two lines, spaced capitals and an initial accent.',
    extra: true,
  },
  {
    kind: 'logo-emblems',
    title: 'Emblems and Badges',
    description:
      'Six logo pages of contained marks: a badge, a seal, a hexagon, a stamp, a square badge and a diamond.',
    extra: true,
  },
  {
    kind: 'logo-marks',
    title: 'Marks and App Icons',
    description:
      'Six logo pages of symbols on their own: a disc, an app icon, rings, an initial, peaks and a star.',
    extra: true,
  },
  {
    kind: 'wireframe-social-app',
    title: 'Social App Wireframe',
    description:
      'Six iPhone screens of a social app: the feed, stories, a post, a new post, notifications and a profile.',
    extra: true,
  },
  {
    kind: 'wireframe-delivery-app',
    title: 'Delivery App Wireframe',
    description:
      'Five iPhone screens of a delivery app: the shop, search, an item, the cart and live order tracking.',
    extra: true,
  },
  {
    kind: 'wireframe-travel-app',
    title: 'Travel App Wireframe',
    description:
      'Four iPhone screens of a travel app: flight search, results, a boarding pass and places to explore.',
    extra: true,
  },
  {
    kind: 'wireframe-ride-app',
    title: 'Ride App Wireframe',
    description:
      'Four iPhone screens of a ride app: sign in, where to, the ride on its way and its updates.',
    extra: true,
  },
  {
    kind: 'wireframe-music-app',
    title: 'Music App Wireframe',
    description:
      'Four iPhone screens of a music app: browse, search, now playing and a podcast episode.',
    extra: true,
  },
  {
    kind: 'wireframe-app-onboarding',
    title: 'App Sign Up Wireframe',
    description:
      'Five iPhone screens of a first run: welcome, sign up, a code to verify, permissions and an empty first screen.',
    extra: true,
  },
  {
    kind: 'wireframe-online-store',
    title: 'Online Store Wireframe',
    description:
      'Four browser pages of an online store: the shop, a product, the cart and checkout.',
    extra: true,
  },
  {
    kind: 'wireframe-blog',
    title: 'Blog Wireframe',
    description: 'Three browser pages of a blog: the latest posts, an article and a contact page.',
    extra: true,
  },
  {
    kind: 'wireframe-company-site',
    title: 'Company Site Wireframe',
    description: 'Four browser pages of a company site: home, the team, help pages and contact.',
    extra: true,
  },
  {
    kind: 'wireframe-project-tool',
    title: 'Project Tool Wireframe',
    description:
      'Four laptop screens of a project tool: a board, a task list, a calendar and the team.',
    extra: true,
  },
  {
    kind: 'wireframe-team-inbox',
    title: 'Team Inbox Wireframe',
    description:
      'Four laptop screens of a team inbox: the inbox, a conversation, notifications and settings.',
    extra: true,
  },
  {
    kind: 'wireframe-video-app',
    title: 'Video App Wireframe',
    description: 'Four iPad screens of a video app: browse, search, watch and a profile.',
    extra: true,
  },
  {
    kind: 'wireframe-fitness-watch',
    title: 'Fitness Watch Wireframe',
    description:
      'Four watch faces of a fitness app: a workout, heart rate, an interval timer and the weather.',
    extra: true,
  },
  {
    kind: 'wireframe-watch-music',
    title: 'Watch Music Wireframe',
    description: 'Two watch faces of a music app: what is playing and what is up next.',
    extra: true,
  },
];

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-design-route.md).
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATES.some((t) => t.kind === value);
}

// Templates retired for a better one, by their old kind: a link, an agent or a seed naming one makes
// its replacement. The diagram-mode device wireframes became wireframe pages in their devices
// (docs/specs/007-editor/wireframe-pages.md "Templates").
const RETIRED_TEMPLATE_KINDS: Readonly<Record<string, TemplateKind>> = {
  'mobile-wireframe': 'wireframe-mobile-app',
  'laptop-wireframe': 'wireframe-dashboard',
  'browser-wireframe': 'wireframe-website',
};

/** The template a kind names: itself, a retired kind's replacement, else null. For a kind that
 *  arrives as a plain string from outside (a link, an agent, a seed). */
export function templateKindOf(value: unknown): TemplateKind | null {
  if (isTemplateKind(value)) return value;
  return typeof value === 'string' && Object.hasOwn(RETIRED_TEMPLATE_KINDS, value)
    ? RETIRED_TEMPLATE_KINDS[value]!
    : null;
}

// The editor URL that creates this template without the wizard and opens it
// (docs/specs/007-editor/new-design-route.md): what an outside surface links to, such as the marketing site's
// template gallery (docs/specs/019-marketing/marketing-site.md). The route is the editor's; the builder lives
// here so every caller spells the query the same way `isTemplateKind` reads.
export function templateCreateHref(kind: TemplateKind): string {
  return `/new?template=${encodeURIComponent(kind)}`;
}

// Default name for a freshly-created design: "Untitled <Template Title>" in
// title case so a templated design is recognisable in the Explorer (e.g.
// "Untitled Logo Design"), while a blank one (or no template) keeps the plain
// "Untitled design" (UNTITLED_DESIGN_NAME, legacy-untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_DESIGN_NAME;
  // A blank names what it makes ("Untitled Logo"), not the card ("Blank Logo").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DESIGN_NAME;
}

// Every name a design is given before anyone names it: each template's untitled name, plus "Untitled design" and
// its legacy spelling. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a design still has a default name (docs/specs/007-editor/new-design-route.md "What `/new` makes"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultDesignName(name: string): boolean {
  DEFAULT_NAMES ??= new Set(TEMPLATES.map((t) => untitledNameForTemplate(t.kind)));
  return isUntitledDesignName(name) || DEFAULT_NAMES.has(name);
}
