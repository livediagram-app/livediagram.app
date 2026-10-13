// Slide deck templates built from the slide layouts (docs/specs/008-canvas/canvas-and-palette.md
// "Templates on pages", docs/specs/007-editor/templates-by-mode.md "Slide deck templates"): each a
// handful of slide pages, each page one slide layout (slide-layouts-*.ts) with its sample text
// replaced by the deck's own, in the order the layout writes it. Each opens and closes on an
// animated background of its own colours (docs/specs/007-editor/illustrate-pages.md "Animated
// backgrounds"); the slides between sit on a soft still gradient, so they read and print plainly.
// Pure: the pages are declared once and the elements built on them.
import {
  layOutIllustratePages,
  pageInkFor,
  PAGE_GRADIENT_ANGLE,
  type Element,
  type IllustratePage,
  type PageBackground,
  type PageMotion,
} from '@livediagram/document';
import { buildPageLayout } from './page-layout-build';
import type { PageLayoutId } from './page-layouts';
import { templateSlidePage } from './template-page-kit';

export type LayoutDeckKind =
  'launch-keynote' | 'quarterly-review' | 'team-welcome' | 'workshop-kickoff';

type DeckSlide = {
  name: string;
  layout: PageLayoutId;
  // The layout's text, in the order it writes it (the same count: layout-decks.test.ts pins it).
  labels: readonly string[];
  // What to say over it, kept on its headline as the element's note.
  notes: string;
};

type LayoutDeck = {
  // The opening and closing slides' animated background, in the deck's own colours.
  motion: PageMotion;
  dark: { from: string; to: string };
  // The slides between: a soft still gradient.
  light: { from: string; to: string };
  slides: readonly DeckSlide[];
};

const animated = (d: LayoutDeck): PageBackground => ({
  fill: { kind: 'gradient', ...d.dark, angle: PAGE_GRADIENT_ANGLE, motion: d.motion },
});
const still = (d: LayoutDeck): PageBackground => ({
  fill: { kind: 'gradient', ...d.light, angle: PAGE_GRADIENT_ANGLE },
});

export const LAYOUT_DECKS: Record<LayoutDeckKind, LayoutDeck> = {
  // A product launch keynote for a made-up note-taking app, Lumen: the hook, why it matters, what
  // it does, the numbers from the beta, the plan to launch, and the ask.
  'launch-keynote': {
    motion: 'aurora',
    dark: { from: '#0b1020', to: '#312e81' },
    light: { from: '#f8fafc', to: '#eef2ff' },
    slides: [
      {
        name: 'Launch',
        layout: 'slide-keynote',
        labels: [
          'INTRODUCING',
          'Lumen 2.0',
          'Notes that find you, before you go looking',
          'Priya Shah · Lumen Launch Event · March 2027',
        ],
        notes: 'Let the logo sit for a beat. Then: "Raise your hand if you lost a note this week."',
      },
      {
        name: 'The Hook',
        layout: 'slide-question',
        labels: [
          'A QUICK QUESTION',
          'How much of what you wrote down last month could you find right now?',
          'Most people say less than a third. We think that is the real problem.',
        ],
        notes: 'Wait for answers. Repeat one back.',
      },
      {
        name: 'What It Does',
        layout: 'slide-three-points',
        labels: [
          'What is new in 2.0',
          'Recall',
          'Surfaces the note you need when the meeting it is about starts.',
          'Private',
          'Runs on your device; your notes never train anything.',
          'Together',
          'Share a notebook and see edits land live.',
        ],
        notes: 'Demo Recall here if the Wi-Fi holds.',
      },
      {
        name: 'The Beta',
        layout: 'slide-three-stats',
        labels: [
          'Six months of beta, in three numbers',
          '41k',
          'beta testers',
          'from 62 countries',
          '3.1x',
          'more notes reopened',
          'than in Lumen 1',
          '92%',
          'would miss it',
          'if it went away tomorrow',
          'Source: Lumen beta analytics, September 2026 to February 2027.',
        ],
        notes: 'Lead with the 92%. That is the one that matters.',
      },
      {
        name: 'Launch Plan',
        layout: 'slide-process-flow',
        labels: [
          'From today to everyone',
          'Four steps over the next eight weeks.',
          'Today',
          'Beta testers move to 2.0 tonight.',
          'Week 2',
          'Open to everyone on the waitlist.',
          'Week 4',
          'Teams and shared notebooks.',
          'Week 8',
          'Lumen 2.0 in every app store.',
        ],
        notes: 'Keep it brisk: dates, not features.',
      },
      {
        name: 'The Ask',
        layout: 'slide-cta',
        labels: [
          'ONE THING TO DO TONIGHT',
          'Open Lumen, write one note, and let it find you tomorrow.',
          'Get Lumen 2.0',
          'lumen.example.com',
        ],
        notes: 'Stop talking. Put the link up. Smile.',
      },
    ],
  },
  // A quarterly business review for a support team: the agenda, the headline result, the goals,
  // what is next, who does what, and questions.
  'quarterly-review': {
    motion: 'mesh',
    dark: { from: '#082f49', to: '#1e3a8a' },
    light: { from: '#f8fafc', to: '#e0f2fe' },
    slides: [
      {
        name: 'Q3 Review',
        layout: 'slide-keynote',
        labels: [
          'QUARTERLY BUSINESS REVIEW',
          'Customer Support, Q3',
          'Faster answers, happier customers, a smaller backlog',
          'Support Leadership · Monthly All-Hands · October 2026',
        ],
        notes: 'Thank the team first. Three of them closed the big backlog.',
      },
      {
        name: 'Agenda',
        layout: 'slide-agenda-grid',
        labels: [
          'In the next 45 minutes',
          '01',
          'The quarter',
          '10 min',
          '02',
          'Against our goals',
          '10 min',
          '03',
          'Next quarter',
          '15 min',
          '04',
          'Your questions',
          '10 min',
        ],
        notes: 'Ask people to hold questions to the end.',
      },
      {
        name: 'The Quarter',
        layout: 'slide-big-chart',
        labels: [
          'Tickets solved each month',
          'More solved every month since we moved to one queue.',
          '+62%',
          'tickets solved in September than in April',
          'Source: help desk reports, April to September 2026.',
        ],
        notes: 'The jump in June is the new queue. Say so.',
      },
      {
        name: 'Goals',
        layout: 'slide-goals',
        labels: [
          'Against our goals for the year',
          '72%',
          'First reply under 1 hour',
          '7,200 of 10,000 tickets',
          '45%',
          'Self-serve answers',
          '450 of 1,000 articles',
          '90%',
          'Satisfaction',
          '4.5 of a 5.0 target',
          'Source: support dashboard, figures to 30 September 2026.',
        ],
        notes: 'Self-serve is behind. Own it, then show the plan on the next slide.',
      },
      {
        name: 'Next Quarter',
        layout: 'slide-now-next-later',
        labels: [
          'What comes next',
          'Now',
          'Article sprint',
          'Chat on the website',
          'Weekend cover',
          'Next',
          'Smart routing',
          'Customer health scores',
          'Quality reviews',
          'Later',
          'Phone support',
          'A community forum',
          'A status page',
        ],
        notes: 'Now is funded. Next needs a yes today.',
      },
      {
        name: 'Questions',
        layout: 'slide-questions',
        labels: ['Questions?', 'Or ask later in #support-leads'],
        notes: 'Repeat each question before you answer it.',
      },
    ],
  },
  // A welcome deck for a new joiner's first morning: hello, who is their manager, the first week,
  // how the team works, the company's story, and who to ask.
  'team-welcome': {
    motion: 'bokeh',
    dark: { from: '#4a044e', to: '#be185d' },
    light: { from: '#fff7ed', to: '#fdf2f8' },
    slides: [
      {
        name: 'Welcome',
        layout: 'slide-keynote',
        labels: [
          'YOUR FIRST DAY',
          'Welcome to the team',
          'Everything you need for a great first week, in six slides',
          'People Team · Onboarding · Week One',
        ],
        notes: 'Say their name. Mean it.',
      },
      {
        name: 'Your Manager',
        layout: 'slide-speaker',
        labels: [
          'MEET YOUR MANAGER',
          'Sam Okafor',
          'Engineering Lead, Payments',
          'Here six years, two of them on your team',
          'Runs a 1:1 with you every Tuesday',
          'Ask about the time the coffee machine flooded',
        ],
        notes: 'Swap in the real photo and three true facts.',
      },
      {
        name: 'Your First Week',
        layout: 'slide-objectives',
        labels: [
          'By Friday you will have',
          'Three things to do, and lots of help to do them.',
          '1',
          'Shipped a change',
          'A small one, reviewed and live, with your buddy.',
          '2',
          'Met your team',
          'Coffee with each of them; the list is in your inbox.',
          '3',
          'Found your way round',
          'The codebase, the tools, and where the good lunch is.',
        ],
        notes: 'The point of 1 is confidence, not the change.',
      },
      {
        name: 'How We Work',
        layout: 'slide-four-ideas',
        labels: [
          'How we work',
          'Write it down',
          'Decisions live in docs, not in hallways.',
          'Ask early',
          'A question today saves a day of rework.',
          'Small changes',
          'Ship little and often; review the same day.',
          'Celebrate',
          'Wins go in #shout-outs, every Friday.',
        ],
        notes: 'Give a real example of each.',
      },
      {
        name: 'Our Story',
        layout: 'slide-milestones',
        labels: [
          'How we got here',
          '2018',
          'Founded in a spare bedroom',
          '2020',
          'First paying customer',
          '2022',
          'Fifty of us, two offices',
          '2024',
          'A million payments a day',
          '2026',
          'You joined',
        ],
        notes: 'End on "You joined". Pause there.',
      },
      {
        name: 'Who To Ask',
        layout: 'slide-contact',
        labels: [
          'YOUR GO-TO PERSON',
          'Jo Lindqvist',
          'Your onboarding buddy',
          'jo@example.com',
          'example.com/handbook',
          '#help-new-joiners',
        ],
        notes: 'Introduce the buddy in person if they are in the room.',
      },
    ],
  },
  // A kick-off for a half-day design workshop: why we are here, the outcomes, the agenda, how the
  // session runs, the ground rules, and a close.
  'workshop-kickoff': {
    motion: 'waves',
    dark: { from: '#042f2e', to: '#0f766e' },
    light: { from: '#f0fdfa', to: '#ecfeff' },
    slides: [
      {
        name: 'Welcome',
        layout: 'slide-keynote',
        labels: [
          'DESIGN WORKSHOP',
          'Rethinking checkout',
          'One morning to turn twelve complaints into three ideas we can test',
          'Facilitated by Lee Park · Studio B · 9:30 to 13:00',
        ],
        notes: 'Start on time. Latecomers catch up in the first exercise.',
      },
      {
        name: 'Outcomes',
        layout: 'slide-objectives',
        labels: [
          'By lunch we will have',
          'Three things, made together.',
          '1',
          'One shared problem',
          'Written in a sentence everyone agrees with.',
          '2',
          'Three ideas',
          'Sketched, voted on and owned by a pair.',
          '3',
          'A test plan',
          'Who we ask, what we show them, by when.',
        ],
        notes: 'Read these out. Ask: anything missing?',
      },
      {
        name: 'Agenda',
        layout: 'slide-agenda-grid',
        labels: [
          'This morning',
          '01',
          'Listen to customers',
          '45 min',
          '02',
          'Sketch alone',
          '40 min',
          '03',
          'Share and vote',
          '45 min',
          '04',
          'Plan the tests',
          '30 min',
        ],
        notes: 'Break after 02. Coffee is outside.',
      },
      {
        name: 'How It Runs',
        layout: 'slide-process-flow',
        labels: [
          'How each round runs',
          'Same rhythm every time, so you can focus on ideas.',
          'Diverge',
          'Everyone works alone, in silence.',
          'Share',
          'Two minutes each, no questions yet.',
          'Vote',
          'Three dots each, on the ideas, not the people.',
          'Decide',
          'The owner of the problem has the last word.',
        ],
        notes: 'This is the slide people forget. Leave it up during round one.',
      },
      {
        name: 'Ground Rules',
        layout: 'slide-takeaway',
        labels: [
          'THE ONE RULE',
          'Quantity first. Judge later.',
          'What that means today',
          'Every idea goes on a sticky',
          'Laptops closed unless we are looking something up',
          'Build on ideas: "yes, and"',
        ],
        notes: 'Say the rule twice.',
      },
      {
        name: 'Close',
        layout: 'slide-cta',
        labels: [
          'BEFORE YOU GO',
          'Pick the idea you would test first, and tell the person next to you why.',
          'Sign up to a test',
          'example.com/checkout-tests',
        ],
        notes: 'Thank everyone. Photos of the wall go in the channel.',
      },
    ],
  },
};

/** A deck's pages: one 16:9 slide page per slide, the first and last on its animated background. */
export function layoutDeckPages(kind: LayoutDeckKind): IllustratePage[] {
  const deck = LAYOUT_DECKS[kind];
  const last = deck.slides.length - 1;
  return deck.slides.map((s, i) =>
    templateSlidePage(i + 1, s.name, i === 0 || i === last ? animated(deck) : still(deck)),
  );
}

/** A deck's elements: each slide's layout on its page, its text the deck's own, its notes on its
 *  headline (the first text the layout writes). */
export function buildLayoutDeck(kind: LayoutDeckKind): Element[] {
  const deck = LAYOUT_DECKS[kind];
  const declared = layoutDeckPages(kind);
  const pages = layOutIllustratePages(declared);
  const built = pages.flatMap((page, i) => {
    const slide = deck.slides[i]!;
    let at = 0;
    return buildPageLayout(slide.layout, page).map((el) => {
      const own = el as Element & { label?: string };
      const out = { ...el } as Element & {
        label?: string;
        note?: string;
      };
      if (typeof own.label === 'string' && own.label.length > 0) {
        if (at < slide.labels.length) out.label = slide.labels[at]!;
        if (at === 0) out.note = slide.notes;
        at += 1;
      }
      return out as Element;
    });
  });
  // Each page's content inked for its background, as a fill picked in the editor is (re-inking):
  // icons and text with no colour of their own read on the deck's dark and pale colours alike.
  let tab = { elements: built, pages: declared };
  for (const page of declared) tab = pageInkFor(tab, page.id, page.background).tab;
  return tab.elements;
}
