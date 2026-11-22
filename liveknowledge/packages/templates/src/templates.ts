import { isUntitledName, titleCase } from '@liveknowledge/api-schema';
import { UNTITLED_DOCUMENT_NAME, isUntitledDocumentName } from './untitled';

// The Pages templates (docs/specs/008-canvas/canvas-and-palette.md "Templates"): every template opens in Pages,
// on pages of its own.
export type TemplateKind =
  // Blank Tab: an empty tab, made by name (an agent's add_tab, a `/new?blank` link); in no category.
  | 'blank'
  // Blank Illustration (docs/specs/008-canvas/canvas-and-palette.md "Templates"): one empty page, which asks what
  // it is for. A quick-pick, never inside a category grid.
  | 'blank-illustration'
  // The blanks of a page kind (docs/specs/007-editor/start-diagramming.md "Groups"): one empty
  // page whose kind is already chosen (blank-page-templates.ts), so it never asks what it is for.
  | 'blank-slide-deck'
  | 'blank-article'
  | 'blank-infographic'
  // A six-slide pitch on 16:9 slide pages.
  | 'slide-deck'
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
  | 'workshop-kickoff'
  // Written documents (article-templates.ts): articles that use tables, contents, headers and footers as a real
  // document of their kind would.
  | 'meeting-notes'
  | 'lesson-plan'
  | 'business-proposal'
  | 'design-doc'
  | 'status-report'
  | 'cover-letter'
  // A lesson deck built from the slide layouts, like the decks above.
  | 'class-lesson'
  // More written documents (article-templates-2.ts).
  | 'product-one-pager'
  | 'research-report'
  | 'newsletter'
  | 'case-study'
  | 'onboarding-handbook'
  // A board update deck built from the slide layouts (template-board-update.ts).
  | 'board-update';

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

// liveknowledge lists writing only (docs/specs/002-project-scope/not-in-liveknowledge.md): the slide and infographic
// templates the fork brought are not in the catalogue, so no picker, link, agent or script can name one (isTemplateKind
// reads this list). Their kinds stay in TemplateKind, and their builders in place, until the dead code is deleted.
export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank Knowledgebase',
    description: 'An empty knowledgebase: one page, ready to write.',
  },
  {
    kind: 'blank-article',
    title: 'Blank Knowledgebase',
    description: 'One empty knowledgebase: a first page to write on.',
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
      'A project brief for a real change: the summary, why now, the goals in a table, the plan and the open questions, with a header and page numbers.',
    extra: true,
  },
  {
    kind: 'meeting-notes',
    title: 'Meeting Notes',
    description:
      'Notes from a weekly team meeting: who came, the agenda, the decisions in a table and the actions with their owners.',
    extra: true,
  },
  {
    kind: 'lesson-plan',
    title: 'Lesson Plan',
    description:
      'A one-hour science lesson: objectives, what to prepare, the timings in a table, differentiation and homework.',
    extra: true,
  },
  {
    kind: 'business-proposal',
    title: 'Business Proposal',
    description:
      'A proposal to win a client: a title page, contents, the problem and approach, a timeline and a pricing table.',
    extra: true,
  },
  {
    kind: 'design-doc',
    title: 'Design Doc',
    description:
      'A technical design doc: contents, context and goals, the proposed design with code, the options weighed and rollout.',
    extra: true,
  },
  {
    kind: 'status-report',
    title: 'Status Report',
    description:
      'A monthly project status report: the headline, each workstream in a status table, the budget with its source, risks and next steps.',
    extra: true,
  },
  {
    kind: 'cover-letter',
    title: 'Cover Letter',
    description:
      'A one-page cover letter in the Classic look: your details, the date, three short paragraphs and a sign-off.',
    extra: true,
  },
  {
    kind: 'product-one-pager',
    title: 'Product One-Pager',
    description:
      'A new feature on one page: the problem, who it is for, what we build and how we measure it, each in a table, and what we will not do.',
    extra: true,
  },
  {
    kind: 'research-report',
    title: 'Research Report',
    description:
      'A study written up: a title page, contents, the method in a table, the findings and recommendations, and every source in a footnote.',
    extra: true,
  },
  {
    kind: 'newsletter',
    title: 'Newsletter',
    description:
      "A roastery's monthly newsletter: an In This Issue contents, a lead story, new coffees in a table, a quote and what is on.",
    extra: true,
  },
  {
    kind: 'case-study',
    title: 'Case Study',
    description:
      "A client success story: the project at a glance, the challenge, what was done, the results in a table, and the client's words.",
    extra: true,
  },
  {
    kind: 'onboarding-handbook',
    title: 'Onboarding Handbook',
    description:
      "A new joiner's first month: contents, the first week as a checklist, who to ask and the tools in tables, time off and pay.",
    extra: true,
  },
];

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-document-route.md).
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATES.some((t) => t.kind === value);
}

/** The template a kind names, else null. For a kind that arrives as a plain string from outside
 *  (a link, an agent, a seed). */
export function templateKindOf(value: unknown): TemplateKind | null {
  return isTemplateKind(value) ? value : null;
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
// "Untitled Knowledgebase" (UNTITLED_DOCUMENT_NAME, untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_DOCUMENT_NAME;
  // A blank names what it makes ("Untitled Slide Deck"), not the card ("Blank Slide Deck").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DOCUMENT_NAME;
}

// Every name a document is given before anyone names it: each template's untitled name, plus "Untitled Knowledgebase" and
// its legacy spelling. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a document still has a default name (docs/specs/007-editor/new-document-route.md "What `/new` makes"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultDocumentName(name: string): boolean {
  DEFAULT_NAMES ??= new Set(TEMPLATES.map((t) => untitledNameForTemplate(t.kind)));
  return isUntitledDocumentName(name) || isUntitledName(name) || DEFAULT_NAMES.has(name);
}
