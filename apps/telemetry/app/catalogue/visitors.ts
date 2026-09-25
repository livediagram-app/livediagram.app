// Who arrives: visitors, accounts, page views, the sign-in prompts and the first-visit welcome and tour (spec/22).
// Part of the metric catalogue: import from ../metric-catalogue.

import { pageViewApp, type PageViewApp } from '@livediagram/api-schema';
import type { Metric, MetricStack } from '../metric-series';
import {
  ACTION_SIGN_IN_NUDGE,
  EDITOR_REASONS_OPENED,
  EXPLORER_REASONS_OPENED,
  TOUR_OFFERED,
} from './features';
import { chart } from './helpers';

export const NEW_VISITORS: Metric = {
  category: 'Participant',
  action: 'Created',
  type: null,
  title: 'New Visitors',
};

export const RETURNING_VISITORS: Metric = {
  category: 'Participant',
  action: 'Returned',
  allTypes: true,
  title: 'Returning Visitors',
  blurb:
    'Browsers that came back on a later day than their first visit, counted once per day. Sum of guests and signed-in users.',
};

export const SIGN_UPS: Metric = {
  category: 'Session',
  action: 'SignedUp',
  type: null,
  title: 'Sign-Ups',
};

export const SIGN_INS: Metric = {
  category: 'Session',
  action: 'SignedIn',
  type: null,
  title: 'Sign-Ins',
};

export const SIGN_OUTS: Metric = {
  rising: 'neutral',
  category: 'Session',
  action: 'SignedOut',
  type: null,
  title: 'Sign-Outs',
};

export const ACCOUNTS_DELETED: Metric = {
  rising: 'bad',
  category: 'Session',
  action: 'Deleted',
  type: 'Account',
  title: 'Accounts Deleted',
  blurb: 'Signed-in users who deleted their account and all of its data.',
};

// Stacks shared by more than one tab, defined once like the charts above.
export const ACCOUNT_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'Account Activity',
  blurb:
    'Accounts made, signed into, signed out of, and deleted. Only fires where sign-in is configured.',
  members: [SIGN_UPS, SIGN_INS, SIGN_OUTS, ACCOUNTS_DELETED],
  headline: SIGN_UPS,
};

// Page views by the app that serves them (spec/150). Each app's card sums the
// `Page·View·<path>` rows whose path that app serves.
const pagesOf = (app: PageViewApp, blurb: string): Metric => ({
  category: 'Page',
  action: 'View',
  typeIn: (type) => type !== null && pageViewApp(type) === app,
  title: app,
  blurb,
});

export const MARKETING_PAGES = pagesOf(
  'Marketing',
  'The landing page, features, alternatives, FAQ and legal pages.',
);

export const LIVE_PAGES = pagesOf(
  'Live',
  'The Explorer, the New Diagram wizard, sign-in, and every diagram.',
);

export const HELP_PAGES = pagesOf(
  'Help',
  'The help centre: its home, categories and every article.',
);

export const DASHBOARD_PAGES = pagesOf('Dashboard', 'This public telemetry dashboard.');

// The returning-visitor split by sign-in state (All Visitors below):
// Returning Visitors sums both.
export const RETURNING_GUESTS: Metric = {
  category: 'Participant',
  action: 'Returned',
  type: 'Anonymous',
  title: 'Returning Guests',
  blurb: 'Returning visitors who are not signed in.',
};

export const RETURNING_SIGNED_IN: Metric = {
  category: 'Participant',
  action: 'Returned',
  type: 'Authenticated',
  title: 'Returning Signed-In',
  blurb: 'Returning visitors who are signed in with an account.',
};

// The first visit: the editor's welcome dialog, then the tour.
export const WELCOME_DIALOG_CLOSED = chart(
  'UI',
  'Closed',
  'Welcome Dialog Closed',
  'The editor\u2019s first-visit welcome closed by confirming a display name.',
  { types: ['Welcome'] },
);

export const TOUR_OFFER_DISMISSED = chart(
  'UI',
  'Closed',
  'Tours Declined',
  'The tour turned down on its welcome card, before it started. (The editor records this decline as closing the offer.)',
  { types: ['TourOffer'], rising: 'neutral' },
);

export const TOURS_STARTED = chart('UI', 'Started', 'Tours Started', 'The welcome tour started.', {
  types: ['Tour'],
});

export const TOUR_STEPS_VIEWED = chart(
  'UI',
  'View',
  'Tour Steps Viewed',
  'A step of the tour shown.',
  { typeIn: (t) => (t ?? '').startsWith('TourStep') },
);

export const TOURS_COMPLETED = chart(
  'UI',
  'Ended',
  'Tours Completed',
  'The tour run to its last step.',
  { types: ['TourCompleted'] },
);

export const TOURS_SKIPPED = chart(
  'UI',
  'Ended',
  'Tours Skipped',
  'The tour closed before its end.',
  { types: ['TourSkipped'], rising: 'neutral' },
);

export const WELCOME_TOUR: MetricStack = {
  stack: true,
  title: 'Welcome & Tour',
  blurb:
    'A first visit: the welcome dialog, then the tour offered, started, stepped through, finished or skipped.',
  members: [
    WELCOME_DIALOG_CLOSED,
    TOUR_OFFERED,
    TOUR_OFFER_DISMISSED,
    TOURS_STARTED,
    TOUR_STEPS_VIEWED,
    TOURS_COMPLETED,
    TOURS_SKIPPED,
  ],
  headline: TOURS_STARTED,
};

// Sign-in prompts, by where each one happens (spec/36). The same bottom
// banner runs in the Explorer and the editor, so every banner event names its
// surface; the Assign Action dialog has its own nudge.
export const EXPLORER_BANNER_SIGN_INS = chart(
  'UI',
  'Selected',
  'Explorer Banner: Sign In',
  'The Explorer\u2019s sign-in banner, or the reasons it opened: Sign in clicked.',
  { types: ['SignInBannerExplorer'] },
);

export const EXPLORER_BANNER_DISMISSED = chart(
  'UI',
  'Closed',
  'Explorer Banner: Dismissed',
  'The Explorer\u2019s sign-in banner closed. Dismissing it hides it in the editor too.',
  { types: ['SignInBannerExplorer'], rising: 'neutral' },
);

export const EDITOR_BANNER_SIGN_INS = chart(
  'UI',
  'Selected',
  'Editor Banner: Sign In',
  'The editor\u2019s sign-in banner, or the reasons it opened: Sign in clicked.',
  { types: ['SignInBannerEditor'] },
);

export const EDITOR_BANNER_DISMISSED = chart(
  'UI',
  'Closed',
  'Editor Banner: Dismissed',
  'The editor\u2019s sign-in banner closed. Dismissing it hides it in the Explorer too.',
  { types: ['SignInBannerEditor'], rising: 'neutral' },
);

export const SIGN_IN_PROMPTS: MetricStack = {
  stack: true,
  title: 'Sign-In Prompts',
  blurb:
    'The nudges to make an account, by where they appear: the Explorer banner, the editor banner, and the Assign Action dialog.',
  members: [
    EXPLORER_BANNER_SIGN_INS,
    EXPLORER_REASONS_OPENED,
    EXPLORER_BANNER_DISMISSED,
    EDITOR_BANNER_SIGN_INS,
    EDITOR_REASONS_OPENED,
    EDITOR_BANNER_DISMISSED,
    ACTION_SIGN_IN_NUDGE,
  ],
  // Sign-ins started from either banner: the prompts that worked.
  headline: [EXPLORER_BANNER_SIGN_INS, EDITOR_BANNER_SIGN_INS],
};

// Visitors and page views, for the Dashboard.
export const ALL_VISITORS: MetricStack = {
  stack: true,
  title: 'All Visitors',
  blurb:
    'Browser-days: a first visit, or a browser back on a later day, each counted once per day. Over a week someone back on five days counts five times, so this is visits, not people. Returners split by sign-in.',
  members: [NEW_VISITORS, RETURNING_VISITORS, RETURNING_GUESTS, RETURNING_SIGNED_IN],
  // The split is part of Returning Visitors, so it stays out of the total.
  headline: [NEW_VISITORS, RETURNING_VISITORS],
};

export const PAGE_VIEWS_BY_APP: MetricStack = {
  stack: true,
  title: 'Page Views by App',
  blurb:
    'Every page viewed across the site, by full load or in-app navigation, split by the app that serves it.',
  members: [MARKETING_PAGES, LIVE_PAGES, HELP_PAGES, DASHBOARD_PAGES],
  seeAlso: { view: 'pages', label: 'See Every Page on the Pages Tab' },
};
