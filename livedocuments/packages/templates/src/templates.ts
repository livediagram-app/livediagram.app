import { titleCase } from '@livedocuments/api-schema';
import { UNTITLED_DOCUMENT_NAME, isUntitledDocumentName } from './untitled';

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
  | 'blank-slide-deck'
  | 'blank-article'
  | 'blank-infographic'
  | 'blank-logo'
  | 'blank-wireframe-phone'
  | 'blank-wireframe-tablet'
  | 'blank-wireframe-browser'
  | 'blank-wireframe-laptop'
  | 'blank-wireframe-watch'
  // A six-slide pitch on 16:9 slide pages.
  | 'slide-deck'
  // Logo-design exploration: six labelled artboards (horizontal / stacked lockups with and without a tagline, the
  // mark as an app icon, a one-colour version) plus the brand palette, so a designer picks the composition that
  // fits, deletes the rest, and iterates.
  | 'logo-design'
  // Wireframe templates (docs/specs/007-editor/wireframe-pages.md "Templates"): flows of wireframe pages,
  // each screen a wireframe layout in its device.
  | 'wireframe-mobile-app'
  | 'wireframe-website'
  | 'wireframe-dashboard'
  | 'wireframe-tablet-app'
  | 'wireframe-watch-app'
  // Group card: a greeting card the whole team signs (cover + message wall). The kind id predates the name.
  | 'live-card'
  // Design templates (template-design-pages.ts): a storyboard's numbered shots, and a floor plan drawn to a real
  // metric scale (80px = 1m), each on an A3 page.
  | 'storyboard'
  | 'floor-plan'
  // Articles (docs/specs/007-editor/article-pages.md): a project brief, and Amazon's Working Backwards PR/FAQ.
  | 'working-backwards'
  | 'article'
  // Documents of pages (template-pages.ts).
  | 'event-poster'
  | 'year-in-review'
  | 'resume'
  | 'recipe-card'
  | 'data-story'
  | 'how-it-works'
  | 'versus'
  | 'social-carousel'
  // Slide decks built from the slide layouts (template-builders-layout-decks.ts).
  | 'launch-keynote'
  | 'quarterly-review'
  | 'team-welcome'
  | 'workshop-kickoff';

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
    description: 'An empty page for an infographic, an article, a slide, a logo or a wireframe.',
    extra: true,
  },
  {
    kind: 'blank-slide-deck',
    title: 'Blank Slide Deck',
    description: 'One empty 16:9 slide, ready for your first idea.',
    extra: true,
  },
  {
    kind: 'blank-article',
    title: 'Blank Article',
    description: 'One empty article page: a title and a first paragraph to write.',
    extra: true,
  },
  {
    kind: 'blank-infographic',
    title: 'Blank Infographic',
    description: 'One empty A4 infographic page: lay it out yourself or start from a layout.',
    extra: true,
  },
  {
    kind: 'blank-logo',
    title: 'Blank Logo',
    description: 'One empty square artboard for a mark, a wordmark or a lockup.',
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
    kind: 'slide-deck',
    title: 'Slide Deck',
    description:
      'A six-slide pitch (title, problem, solution, traction, team, the ask) on 16:9 slide pages, with speaker notes.',
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
    kind: 'live-card',
    title: 'Group Card',
    description:
      'A greeting card the whole team signs, on two card pages: a cover with a photo, and an inside of signed notes with a slot for yours.',
    extra: true,
  },
  {
    kind: 'storyboard',
    title: 'Storyboard',
    description:
      'A 30-second ad in six shots: shot and timing chips, sketches, action and sound lines.',
    extra: true,
  },
  {
    kind: 'floor-plan',
    title: 'Floor Plan',
    description:
      'A two-bed flat with study drawn to scale: furniture, colour zones, dimensions and a key.',
    extra: true,
  },
  {
    kind: 'working-backwards',
    title: 'Working Backwards',
    description:
      'Amazon’s PR/FAQ: the launch press release written before anything is built, then the customer and internal FAQs.',
    extra: true,
  },
  {
    kind: 'article',
    title: 'Project Brief',
    description:
      'A project brief, written on pages like a doc: headings and lists to write over, room for charts and drawings in the text.',
    extra: true,
  },
  {
    kind: 'event-poster',
    title: 'Event Poster',
    description:
      'An A3 poster for a community night market: a bold title, the date, time and place, a photo and three highlights.',
    extra: true,
  },
  {
    kind: 'year-in-review',
    title: 'Year in Review',
    description:
      "A four-page team report: a cover, the year's headline numbers, a timeline of its moments and a thank-you.",
    extra: true,
  },
  {
    kind: 'resume',
    title: 'Résumé',
    description:
      'A one-page A4 résumé: name and role, a short profile, an experience timeline, skills and education.',
    extra: true,
  },
  {
    kind: 'recipe-card',
    title: 'Recipe Card',
    description:
      'A recipe to share in two pages: the dish with serves and timings, then the ingredients and the method in steps.',
    extra: true,
  },
  {
    kind: 'data-story',
    title: 'Data Story',
    description:
      'An A4 infographic that tells one story in numbers: a headline stat, pictograms, a then-and-now comparison and a source line.',
    extra: true,
  },
  {
    kind: 'how-it-works',
    title: 'How It Works',
    description:
      'A tall explainer for a story or a phone screen: five illustrated steps down a winding path, from first tap to done.',
    extra: true,
  },
  {
    kind: 'versus',
    title: 'Versus',
    description:
      'Two options side by side on a social post: a split page, matched rows of pros and cons, and a verdict at the foot.',
    extra: true,
  },
  {
    kind: 'social-carousel',
    title: 'Social Carousel',
    description:
      'Five square slides for a LinkedIn or Instagram carousel: a hook, three tips and a call to action, swipe cues included.',
    extra: true,
  },
  {
    kind: 'launch-keynote',
    title: 'Launch Keynote',
    description:
      'A six-slide launch keynote on an animated aurora: the hook, what is new, the beta in three numbers, the launch plan and the ask.',
    extra: true,
  },
  {
    kind: 'quarterly-review',
    title: 'Quarterly Review',
    description:
      'A six-slide quarterly business review on a moving mesh: the agenda, the quarter in a chart, goals as progress rings and the roadmap.',
    extra: true,
  },
  {
    kind: 'team-welcome',
    title: 'Team Welcome',
    description:
      'A six-slide welcome for a new joiner on floating bokeh: their manager, their first week, how the team works and who to ask.',
    extra: true,
  },
  {
    kind: 'workshop-kickoff',
    title: 'Workshop Kickoff',
    description:
      'A six-slide workshop opener on rolling waves: the outcomes, the agenda, how each round runs, the one rule and the close.',
    extra: true,
  },
];

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-document-route.md).
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
// (docs/specs/007-editor/new-document-route.md): what an outside surface links to, such as the marketing site's
// template gallery (docs/specs/019-marketing/marketing-site.md). The route is the editor's; the builder lives
// here so every caller spells the query the same way `isTemplateKind` reads.
export function templateCreateHref(kind: TemplateKind): string {
  return `/new?template=${encodeURIComponent(kind)}`;
}

// Default name for a freshly-created document: "Untitled <Template Title>" in
// title case so a templated document is recognisable in the Explorer (e.g.
// "Untitled Event Poster"), while a blank one (or no template) keeps the plain
// "Untitled document" (UNTITLED_DOCUMENT_NAME, untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_DOCUMENT_NAME;
  // A blank names what it makes ("Untitled Slide Deck"), not the card ("Blank Slide Deck").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DOCUMENT_NAME;
}

// Every name a document is given before anyone names it: each template's untitled name, plus "Untitled document" and
// its legacy spelling. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a document still has a default name (docs/specs/007-editor/new-document-route.md "What `/new` makes"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultDocumentName(name: string): boolean {
  DEFAULT_NAMES ??= new Set(TEMPLATES.map((t) => untitledNameForTemplate(t.kind)));
  return isUntitledDocumentName(name) || DEFAULT_NAMES.has(name);
}
