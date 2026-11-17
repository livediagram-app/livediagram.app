// The slides a presented template seeds its document's deck with (docs/specs/008-canvas/canvas-and-palette.md "What
// a template shows", docs/specs/012-collaboration/presentation-mode.md "Decks a template seeds"), in the order its
// talk track tells it. Each slide names the elements it shows by ANCHORS: the first line of a label (or a card's
// title) on the template, matched whole or, failing that, as its start. The slide holds the anchors, the panel each sits in, and everything wholly
// in the region they cover (template-slides.ts). Anchors, not coordinates, so a redrawn template keeps its deck.
//
// Pure data. template-slides.test.ts holds every slide here to anchors that exist and members it finds.
import type { TemplateKind } from './templates';

export type TemplateSlideSpec = {
  name: string;
  /** What to say over it: the talk track's line for this slide. */
  notes: string;
  /** Labels that mark the slide's region. Absent = the whole board, the overview. */
  anchors?: readonly string[];
  /** Widen the region to the board's full width: a row of a plan whose bars carry no label. */
  rows?: boolean;
  /** Take in what sits straight under the region: a heading's table or entries, which carry no label to anchor. */
  under?: boolean;
};

const overview = (notes: string): TemplateSlideSpec => ({ name: 'Overview', notes });

export const TEMPLATE_SLIDES: Partial<Record<TemplateKind, readonly TemplateSlideSpec[]>> = {
  'comparison-table': [
    overview('Say what we are choosing between, and for whom.'),
    {
      name: 'Why Team',
      notes: 'Land on the highlighted plan, and the reasons it wins.',
      anchors: ['Why Team'],
    },
  ],
  'okr-tree': [
    overview('The quarter on one page: one objective, three key results.'),
    {
      name: 'Objective',
      notes: 'Start with the objective and why it matters this quarter.',
      anchors: ['Make self-serve customers successful'],
    },
    {
      name: 'KR1 · NPS',
      notes: 'Where we are against where we aim, then the initiatives moving it.',
      anchors: ['KR1 · NPS 40 → 55', 'Revamp onboarding', 'In-app help centre'],
    },
    {
      name: 'KR2 · Activation',
      notes: 'Where we are against where we aim, then the initiatives moving it.',
      anchors: ['KR2 · Activation 25% → 40%', 'Guided first project', 'Starter templates'],
    },
    {
      name: 'KR3 · Churn',
      notes: 'Where we are against where we aim, then the initiatives moving it.',
      anchors: ['KR3 · Churn 3.1% → 2%', 'Win-back emails', 'Exit-survey insights'],
    },
  ],
  funnel: [
    overview('Every stage counted over the same window.'),
    {
      name: 'The stages',
      notes: 'Walk down the stages with their counts.',
      anchors: ['12,400', 'paid for a first box'],
    },
    {
      name: 'Biggest drop-off',
      notes: 'Stop at the biggest drop-off, then the experiments that would fix it.',
      anchors: ['Biggest drop-off', 'Experiments to try'],
    },
  ],
  gantt: [
    overview('Start with the launch milestone and the Today line.'),
    {
      name: 'Design',
      notes: 'What is done, what is next, and what it waits on.',
      anchors: ['Design', 'Prototype + usability test'],
      rows: true,
    },
    {
      name: 'Build',
      notes: 'What is done, what is next, and what it waits on.',
      anchors: ['Build', 'iOS + Android app'],
      rows: true,
    },
    {
      name: 'Launch',
      notes: 'The beta, the review and launch day.',
      anchors: ['Launch', 'Launch day'],
      rows: true,
    },
  ],
  roadmap: [
    overview('The whole year at a glance.'),
    {
      name: 'Goal',
      notes: 'The goal at the top: what all of this is for.',
      anchors: ['Goal: 10,000 weekly active teams by December'],
    },
    {
      name: 'Now',
      notes: 'What we are building, with confidence and status.',
      anchors: ['Now', 'Jan to Mar · committed', 'Sync conflicts under 0.1% of edits'],
    },
    {
      name: 'Next',
      notes: 'What we will pick up when Now lands.',
      anchors: ['Next', 'Apr to Jun · scoped', 'Cold start 2.8s → 1s'],
    },
    {
      name: 'Later',
      notes: 'The bets we are watching, not promising.',
      anchors: ['Later', 'Second half · exploring', 'Unlocks the enterprise pilots'],
    },
  ],
  'milestone-timeline': [
    overview('The year on one ribbon.'),
    {
      name: 'Discover',
      notes: 'Start at the left, with where the year began.',
      anchors: ['Discover', 'Kick-off', 'Prototype tested'],
    },
    {
      name: 'Build and launch',
      notes: 'Walk the milestones in order, and land on launch day.',
      anchors: ['Build', 'Launch', 'Private beta', 'Launch day'],
    },
    {
      name: 'Grow',
      notes: 'What came after launch, and what is next.',
      anchors: ['Grow', '10,000 teams', 'Year-two plan'],
    },
  ],
  'milestone-timeline-vertical': [
    overview('Ten years in seven chapters.'),
    {
      name: 'Beginnings',
      notes: 'Read it top to bottom as a story, a big year at a time.',
      anchors: ['A market stall', 'Our first shop', 'Bikes, not doors'],
    },
    {
      name: 'Growing up',
      notes: 'Pause on the highlight.',
      anchors: ['Our own roastery', 'B Corp certified', 'Ten years, twelve shops'],
    },
    {
      name: 'Next chapter',
      notes: 'End on the next chapter.',
      anchors: ['Up north', 'Next chapter'],
    },
  ],
  venn: [
    overview('One idea, three lenses.'),
    {
      name: 'Three lenses',
      notes:
        'Introduce each circle, then each overlap, and finish on the sweet spot in the middle.',
      anchors: ['Desirable', 'Feasible', 'Viable', 'It pays its way'],
    },
    {
      name: 'Ideas we tested',
      notes: 'Where each idea landed, and why.',
      anchors: ['Ideas we tested', 'Cheap to build, pays on paper, nobody asked'],
    },
  ],
  'business-model-canvas': [
    overview('The whole model on one page.'),
    {
      name: '1 · Customer Segments',
      notes: 'Customers first: who we serve.',
      anchors: ['Customer Segments'],
    },
    {
      name: '2 · Value Propositions',
      notes: 'The value we offer them.',
      anchors: ['Value Propositions'],
    },
    { name: '3 · Channels', notes: 'How we reach them.', anchors: ['Channels'] },
    {
      name: '4 · Customer Relationships',
      notes: 'How we keep them.',
      anchors: ['Customer Relationships'],
    },
    { name: '5 · Revenue Streams', notes: 'What it earns.', anchors: ['Revenue Streams'] },
    { name: '6 · Key Resources', notes: 'What it takes to deliver.', anchors: ['Key Resources'] },
    { name: '7 · Key Activities', notes: 'What we do every week.', anchors: ['Key Activities'] },
    { name: '8 · Key Partners', notes: 'Who we rely on.', anchors: ['Key Partners'] },
    { name: '9 · Cost Structure', notes: 'And what it all costs.', anchors: ['Cost Structure'] },
  ],
  pyramid: [
    overview('Strategy on a page, read top down.'),
    {
      name: 'Purpose',
      notes: 'Purpose first: why we exist.',
      anchors: ['Why do we exist?'],
      rows: true,
    },
    { name: 'Vision', notes: 'Where we are going.', anchors: ['Where are we going?'], rows: true },
    { name: 'Strategy', notes: 'How we will win.', anchors: ['How will we win?'], rows: true },
    {
      name: 'Goals',
      notes: 'What we will hit this year.',
      anchors: ['What will we hit this year?'],
      rows: true,
    },
    {
      name: 'Initiatives',
      notes: 'End with the initiatives running this quarter.',
      anchors: ['What are we doing now?'],
      rows: true,
    },
  ],
  'incident-postmortem': [
    overview('What happened, in the order the review tells it.'),
    { name: 'Summary', notes: 'The impact, in one paragraph.', anchors: ['Summary'] },
    {
      name: 'Timeline',
      notes: 'Read the timeline together, trigger to resolution.',
      anchors: ['Trigger', 'Resolution'],
      under: true,
    },
    {
      name: 'Five whys',
      notes: 'From the trigger down, until the answer is the system.',
      anchors: ['Five whys', 'Root cause'],
    },
    {
      name: 'What we learned',
      notes: 'What hurt, what helped, and where we got lucky.',
      anchors: ['Contributing factors', 'Where we got lucky'],
    },
    {
      name: 'Action items',
      notes: 'The follow-ups, each with an owner and a date.',
      anchors: ['Action items', 'P1s land'],
      under: true,
    },
  ],
};
