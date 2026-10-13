// More People layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"), category 'people':
// pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the page's
// content box so each fits every size and orientation, in the tab's theme. The builders live in
// page-layouts-set-people-2.ts and -3.ts, their shared parts in -parts.ts.
import type { PageLayout } from './page-layouts';
import {
  buildOrgChart,
  buildSpeakers,
  buildSpotlight,
  buildTestimonials,
} from './page-layouts-set-people-2';
import {
  buildIdeaBoard,
  buildPersona,
  buildShoutOuts,
  buildValues,
} from './page-layouts-set-people-3';

export type PeopleSetLayoutId =
  | 'org-chart'
  | 'testimonials'
  | 'meet-the-speakers'
  | 'employee-spotlight'
  | 'values'
  | 'idea-board'
  | 'persona'
  | 'shout-outs';

export const PEOPLE_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'org-chart',
    category: 'people',
    label: 'Org Chart',
    description: 'A lead, three crew leads under them and who is in each crew',
    build: buildOrgChart,
  },
  {
    id: 'testimonials',
    category: 'people',
    label: 'Testimonials',
    description: 'Three customer quotes, each with a star rating, a photo and a name',
    build: buildTestimonials,
  },
  {
    id: 'meet-the-speakers',
    category: 'people',
    label: 'Meet the Speakers',
    description: 'Four speakers, each a photo, a time, a name and their talk',
    build: buildSpeakers,
  },
  {
    id: 'employee-spotlight',
    category: 'people',
    label: 'Spotlight',
    description: 'One colleague: a photo, quick facts and three interview answers',
    build: buildSpotlight,
  },
  {
    id: 'values',
    category: 'people',
    label: 'Our Values',
    description: 'Six values, each an icon, a name and a line on what it means',
    build: buildValues,
  },
  {
    id: 'idea-board',
    category: 'people',
    label: 'Idea Board',
    description: 'A question, six ideas on sticky notes with their votes, and the next step',
    build: buildIdeaBoard,
  },
  {
    id: 'persona',
    category: 'people',
    label: 'Persona',
    description: 'A user persona: who they are, a quote, goals, frustrations and traits',
    build: buildPersona,
  },
  {
    id: 'shout-outs',
    category: 'people',
    label: 'Shout-outs',
    description: 'A colleague of the month and three thank-you notes',
    build: buildShoutOuts,
  },
];
