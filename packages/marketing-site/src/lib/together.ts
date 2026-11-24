// How work moves between the apps (liveworkspace/docs/specs/010-site/site.md "The front door", "How work moves
// between them"): the features that hand work from one app to another, one card each. liveworkspace.app shows them
// all; each product's landing page shows the ones it takes part in (togetherFor). Only what is on main; a
// feature that joins apps changes this list in the same change. lib/together.test.ts holds every card to the listed
// apps, a real help article and words free of any price.

import { helpUrl } from '@liveworkspace/help-registry/hrefs';
import type { HelpScope } from '@liveworkspace/help-registry/apps';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';

// Where a card's link goes: a help article, as `<categorySlug>/<slug>` on its canonical scope's help centre (names
// only, so the page never carries the catalogue; the test holds both to it), or a page of this site.
export type TogetherLink =
  { kind: 'help'; scope: HelpScope; path: string } | { kind: 'page'; href: string; label: string };

export type TogetherCard = {
  key: string;
  title: string;
  body: string;
  // The apps it starts from, then the apps it lands in. With no `to`, every app in `from` takes part alike.
  from: readonly SiteId[];
  to?: readonly SiteId[];
  // Both ways: the arrow points each way (Diagrams and Plans).
  both?: boolean;
  link: TogetherLink;
};

const EVERY_APP: readonly SiteId[] = [
  'livediagram.app',
  'liveplanner.app',
  'livedocuments.app',
  'livedesign.app',
  'livehuddle.app',
  'liveknowledge.app',
];

export const TOGETHER: readonly TogetherCard[] = [
  {
    key: 'send-to-plan',
    title: 'Send to Plan',
    body: 'Turn a sticky, a comment, a paragraph or a meeting’s action into a liveplanner card. The card links back, and the place it came from shows its status, live.',
    from: [
      'livediagram.app',
      'livedocuments.app',
      'livedesign.app',
      'livehuddle.app',
      'liveknowledge.app',
    ],
    to: ['liveplanner.app'],
    link: { kind: 'help', scope: 'all', path: 'collaboration/send-to-plan' },
  },
  {
    key: 'send-to-diagram',
    title: 'Send to Diagram',
    body: 'Pick the words on a knowledgebase page that describe a process or a system, and AI draws them as a livediagram diagram, previewed before anything is made.',
    from: ['liveknowledge.app'],
    to: ['livediagram.app'],
    link: { kind: 'help', scope: 'liveknowledge', path: 'collaboration/send-to-diagram' },
  },
  {
    key: 'diagrams-and-plans',
    title: 'Diagrams and Plans',
    body: 'Make Plan Cards turns shapes into cards and arrows into Blocked By. View As Diagram draws a plan as a diagram that redraws itself as the plan changes.',
    from: ['livediagram.app'],
    to: ['liveplanner.app'],
    both: true,
    link: { kind: 'help', scope: 'livediagram', path: 'collaboration/make-plan-cards' },
  },
  {
    key: 'live-data',
    title: 'Live Data From a Plan',
    body: 'A chart or table in a diagram, document or design follows a liveplanner Sheet range, a board’s counts or a Dashboard metric, so a report is never a stale copy.',
    from: ['liveplanner.app'],
    to: ['livediagram.app', 'livedocuments.app', 'livedesign.app'],
    link: { kind: 'help', scope: 'all', path: 'palette/tools/data-elements/live-data' },
  },
  {
    key: 'embed-file',
    title: 'Embed File',
    body: 'Show a plan, diagram, document, design or knowledgebase live inside another app’s work, kept in step as its people change it.',
    from: [
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'liveknowledge.app',
    ],
    link: { kind: 'help', scope: 'all', path: 'palette/embed-elements' },
  },
  {
    key: 'start-a-call',
    title: 'Start a Call Here',
    body: 'Start a livehuddle call from whatever you have open. Its summary lands as a knowledgebase page and its actions as plan cards.',
    from: [
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'liveknowledge.app',
    ],
    to: ['livehuddle.app'],
    link: { kind: 'help', scope: 'all', path: 'collaboration/start-a-call' },
  },
  {
    key: 'automations',
    title: 'Automations Across Apps',
    body: 'A rule in one app can act in another: create a card in a plan, write a page in a knowledgebase, post in a Space or notify people in every app.',
    from: EVERY_APP,
    link: { kind: 'help', scope: 'all', path: 'tools/automations' },
  },
  {
    key: 'ask-ai',
    title: 'Ask AI',
    body: 'Ask a question in any app’s Tools and get an answer from the work you have open, with its sources. A knowledgebase’s Ask reads the diagrams, plans, documents, designs and Spaces connected to it too.',
    from: EVERY_APP,
    link: { kind: 'help', scope: 'liveknowledge', path: 'knowledgebase/ask-across-apps' },
  },
  {
    key: 'start-a-project',
    title: 'Start a Project',
    body: 'One click makes every file a project needs across the apps, in a new folder, each one connected to the others.',
    from: [
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'livehuddle.app',
    ],
    link: { kind: 'page', href: '/kits', label: 'Start a Project' },
  },
];

// Where a card's link opens. A page of liveworkspace.app is relative there and absolute on a product's site.
export function togetherHref(link: TogetherLink, onPlatform = true): string {
  if (link.kind === 'help') return `${helpUrl(link.scope)}/${link.path}/`;
  return onPlatform ? link.href : `${PLATFORM_SITE.url}${link.href}`;
}

// The order a product's landing page picks its cards in: what a visitor of any one app is likeliest to reach for
// first, the suite-wide cards last.
const PRODUCT_ORDER: readonly string[] = [
  'ask-ai',
  'send-to-plan',
  'diagrams-and-plans',
  'send-to-diagram',
  'live-data',
  'start-a-call',
  'automations',
  'embed-file',
  'start-a-project',
];

// The most cards a product's band shows: two rows of three.
export const PRODUCT_CARD_LIMIT = 6;

// The cards a product's landing page shows: those it takes part in, in PRODUCT_ORDER, at most PRODUCT_CARD_LIMIT.
export function togetherFor(app: SiteId): TogetherCard[] {
  return PRODUCT_ORDER.flatMap((key) => {
    const card = TOGETHER.find((c) => c.key === key);
    return card && [...card.from, ...(card.to ?? [])].includes(app) ? [card] : [];
  }).slice(0, PRODUCT_CARD_LIMIT);
}
