import { pageViewApp } from '@livediagram/api-schema';
import { event, pageView, type EventPick, type InsightDef } from './page-insights';

// The Pages tab's insights (spec/150), in funnel order: arriving, starting a
// diagram, finishing one, coming back to work, signing up, and getting help.
// Each is one count over another for the selected window. Pure data; the
// arithmetic is `readInsight` in page-insights.ts.

const isExplorer = (p: string) => p === '/explorer' || p.startsWith('/explorer/');

// A visitor-day: a browser's first day (`Participant·Created`) or a later day
// it came back on (`Participant·Returned`, once per browser per day).
const visitorDays: EventPick = (c, a) =>
  c === 'Participant' && (a === 'Created' || a === 'Returned');

export const PAGE_INSIGHTS: InsightDef[] = [
  {
    id: 'landing-to-new',
    title: 'Landing to New Diagram',
    detail: 'Views of the New Diagram wizard for every 100 views of the landing page.',
    from: pageView((p) => p === '/'),
    to: pageView((p) => p === '/new'),
    fromLabel: '/',
    toLabel: '/new',
    scale: 100,
    unit: 'per 100',
    rising: 'good',
  },
  {
    id: 'wizard-completion',
    title: 'Wizard Completion',
    detail: 'Diagrams created for every 100 views of the New Diagram wizard.',
    from: pageView((p) => p === '/new'),
    to: event('Diagram', 'Created'),
    fromLabel: '/new',
    toLabel: 'Diagram created',
    scale: 100,
    unit: 'per 100',
    rising: 'good',
  },
  {
    id: 'explorer-to-diagram',
    title: 'Explorer to Diagram',
    detail: 'Diagrams opened for every 100 views of an Explorer page.',
    from: pageView(isExplorer),
    to: pageView((p) => p === '/diagram'),
    fromLabel: 'Explorer',
    toLabel: '/diagram',
    scale: 100,
    unit: 'per 100',
    rising: 'good',
  },
  {
    id: 'sign-up-conversion',
    title: 'Sign-Up Conversion',
    detail:
      'Accounts made for every 100 views of the sign-up page. Only fires where sign-in is configured.',
    from: pageView((p) => p === '/get-started'),
    to: event('Session', 'SignedUp'),
    fromLabel: '/get-started',
    toLabel: 'Signed up',
    scale: 100,
    unit: 'per 100',
    rising: 'good',
  },
  {
    id: 'help-per-diagram',
    title: 'Help per Diagram',
    detail: 'Help-centre page views for every 100 diagram views.',
    from: pageView((p) => p === '/diagram'),
    to: pageView((p) => pageViewApp(p) === 'Help'),
    fromLabel: '/diagram',
    toLabel: 'Help pages',
    scale: 100,
    unit: 'per 100',
    rising: 'neutral',
  },
  {
    id: 'pages-per-visitor',
    title: 'Pages per Visitor',
    detail: 'Page views for every visitor, counting each browser once a day it visits.',
    from: visitorDays,
    to: pageView(() => true),
    fromLabel: 'Visitors',
    toLabel: 'Page views',
    scale: 1,
    unit: 'pages',
    rising: 'good',
  },
];
