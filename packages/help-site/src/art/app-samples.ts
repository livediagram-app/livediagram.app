// The sample names the shared scenes write on their work, in the words of the app the help is built for
// (artApp()): a livehuddle help shows spaces such as "Team Office", never a diagram's "Data model". Under All Apps
// (and in a test that sets no app) the diagram names stand.
import { artApp, type ArtApp } from './art-app';

export interface AppSamples {
  /** Eight names of pieces of work: four most used, then four recent ones. */
  work: readonly [string, string, string, string, string, string, string, string];
  /** Tab names: the one being worked on, then its neighbour. */
  tabs: readonly [string, string];
  /** Folder names in a team's shared tree. */
  folders: readonly [string, string];
  /** A short label on the element a style scene colours. */
  element: string;
}

const SAMPLES: Record<ArtApp, AppSamples> = {
  livediagram: {
    work: [
      'Roadmap',
      'Payments',
      'Onboarding',
      'Data model',
      'Retro',
      'Auth flow',
      'Sprint 12',
      'Brainstorm',
    ],
    tabs: ['Payments', 'Billing'],
    folders: ['Architecture', 'Onboarding'],
    element: 'API',
  },
  livedesign: {
    work: [
      'Brand kit',
      'App screens',
      'Logo ideas',
      'Launch ads',
      'Menu card',
      'Poster',
      'Icon set',
      'Moodboard',
    ],
    tabs: ['Home screen', 'Checkout'],
    folders: ['Brand', 'Campaigns'],
    element: 'Sign up',
  },
  livedocuments: {
    work: [
      'Pitch deck',
      'Annual report',
      'Newsletter',
      'Event poster',
      'Case study',
      'Course notes',
      'Resume',
      'One-pager',
    ],
    tabs: ['Q3 review', 'Appendix'],
    folders: ['Sales decks', 'Reports'],
    element: 'Heading',
  },
  liveplanner: {
    work: [
      'Product roadmap',
      'Sprint board',
      'Hiring plan',
      'Budget',
      'Launch plan',
      'Bug triage',
      'Content calendar',
      'OKRs',
    ],
    tabs: ['Sprint 12', 'Backlog'],
    folders: ['Engineering', 'Marketing'],
    element: 'In Progress',
  },
  livehuddle: {
    work: [
      'Team Office',
      'All Hands',
      'Design Studio',
      'Friday Social',
      'Workshop Room',
      'Garden',
      'Game Night',
      'Lounge',
    ],
    tabs: ['Ground Floor', 'Rooftop'],
    folders: ['Offices', 'Events'],
    element: 'Welcome',
  },
  liveknowledge: {
    work: [
      'Team Handbook',
      'Engineering Guide',
      'Onboarding',
      'Runbooks',
      'Product Specs',
      'Support Answers',
      'Decisions',
      'Glossary',
    ],
    tabs: ['Getting Started', 'How We Work'],
    folders: ['Engineering', 'People'],
    element: 'Heading',
  },
};

/** The samples for the app the help is built for, the diagram's under All Apps. */
export function appSamples(): AppSamples {
  return SAMPLES[artApp() ?? 'livediagram'];
}
