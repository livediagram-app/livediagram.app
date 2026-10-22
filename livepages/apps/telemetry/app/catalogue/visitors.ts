// Who arrives: visitors, accounts, page views, the sign-in prompts and the first-visit welcome and the tours (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { pageViewApp, type PageViewApp } from '@livepages/api-schema';
import type { Metric, MetricStack } from '../metric-series';
import {
  ACTION_SIGN_IN_NUDGE,
  EDITOR_REASONS_OPENED,
  EXPLORER_REASONS_OPENED,
  PAGES_TOUR_OFFERED,
  ELEMENT_TOURS_OFFERED,
  POWER_USER_OFFERED,
  NEW_VERSION_OFFERED,
} from './features';
import { chart } from './helpers';
import { ELEMENT_TOUR_KINDS, elementTourTokens } from '../element-tour-kinds';

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

// Page views by the app that serves them (docs/specs/017-telemetry/page-view-telemetry.md). Each app's card sums the
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
  'The Explorer, the New Document wizard, sign-in, and every document.',
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

// The first visit: the editor's welcome dialog.
export const WELCOME_DIALOG_CLOSED = chart(
  'UI',
  'Closed',
  'Welcome Dialog Closed',
  'The editor\u2019s first-visit welcome closed by confirming a display name.',
  { types: ['Welcome'] },
);

// The Pages tour (docs/specs/007-editor/pages-tour.md): its own funnel.
export const PAGES_TOUR_DECLINED = chart(
  'UI',
  'Closed',
  'Pages Tours Declined',
  'The Pages tour turned down on its welcome card, before it started.',
  { types: ['PagesTourOffer'], rising: 'neutral' },
);

export const PAGES_TOURS_STARTED = chart(
  'UI',
  'Started',
  'Pages Tours Started',
  'The Pages tour started.',
  { types: ['PagesTour'] },
);

export const PAGES_TOUR_STEPS_VIEWED = chart(
  'UI',
  'View',
  'Pages Tour Steps Viewed',
  'A step of the Pages tour shown.',
  { typeIn: (t) => (t ?? '').startsWith('PagesTourStep') },
);

export const PAGES_TOURS_COMPLETED = chart(
  'UI',
  'Ended',
  'Pages Tours Completed',
  'The Pages tour run to its last step.',
  { types: ['PagesTourCompleted'] },
);

export const PAGES_TOURS_SKIPPED = chart(
  'UI',
  'Ended',
  'Pages Tours Skipped',
  'The Pages tour closed before its end.',
  { types: ['PagesTourSkipped'], rising: 'neutral' },
);

export const PAGES_TOUR: MetricStack = {
  stack: true,
  title: 'Pages Tour',
  blurb:
    'The first time in Pages mode: the Pages tour offered, stepped through, finished or skipped.',
  members: [
    PAGES_TOUR_OFFERED,
    PAGES_TOUR_DECLINED,
    PAGES_TOURS_STARTED,
    PAGES_TOUR_STEPS_VIEWED,
    PAGES_TOURS_COMPLETED,
    PAGES_TOURS_SKIPPED,
  ],
  headline: PAGES_TOURS_STARTED,
};

// Element tours (docs/specs/007-editor/element-tours.md): a tour of one element type, offered beside a selected one.
// One stack for them all, as Show Me's: offered, declined, started (and started per element), steps, how they end.
export const ELEMENT_TOURS_DECLINED = chart(
  'UI',
  'Closed',
  'Element Tours Declined',
  'An element tour turned down with the cross on its Tour toolbar.',
  { types: elementTourTokens('Offer'), rising: 'neutral' },
);

export const ELEMENT_TOURS_STARTED = chart(
  'UI',
  'Started',
  'Element Tours Started',
  'Play pressed on the Tour toolbar beside a selected element.',
  { types: elementTourTokens() },
);

export const ELEMENT_TOURS_BY_KIND: Metric[] = ELEMENT_TOUR_KINDS.map((k) =>
  chart('UI', 'Started', `${k.title} Tours Started`, `Play pressed beside a selected ${k.title}.`, {
    types: [k.token],
  }),
);

export const ELEMENT_TOUR_STEPS_VIEWED = chart(
  'UI',
  'View',
  'Element Tour Steps Viewed',
  'A step of an element tour shown.',
  { typeIn: (t) => ELEMENT_TOUR_KINDS.some((k) => (t ?? '').startsWith(`${k.token}Step`)) },
);

export const ELEMENT_TOURS_COMPLETED = chart(
  'UI',
  'Ended',
  'Element Tours Completed',
  'An element tour run to its last card.',
  { types: elementTourTokens('Completed') },
);

export const ELEMENT_TOURS_SKIPPED = chart(
  'UI',
  'Ended',
  'Element Tours Skipped',
  'An element tour closed before its end.',
  { types: elementTourTokens('Skipped'), rising: 'neutral' },
);

export const ELEMENT_TOURS: MetricStack = {
  stack: true,
  title: 'Element Tours',
  blurb:
    'Tours of one element type, offered beside a selected one: offered, declined, started, stepped through, finished or skipped.',
  members: [
    ELEMENT_TOURS_OFFERED,
    ELEMENT_TOURS_DECLINED,
    ELEMENT_TOURS_STARTED,
    ...ELEMENT_TOURS_BY_KIND,
    ELEMENT_TOUR_STEPS_VIEWED,
    ELEMENT_TOURS_COMPLETED,
    ELEMENT_TOURS_SKIPPED,
  ],
  headline: ELEMENT_TOURS_STARTED,
};

// Show Me (docs/specs/007-editor/show-me.md): the on-demand tours of one surface each. Never offered, so each starts
// only when its button is pressed. One stack for all of them: every start, the starts per surface, then how they end.
const SHOW_ME_SURFACES = [
  { token: 'ShareTour', title: 'Share', where: 'the Share dialog' },
  { token: 'LogoTour', title: 'Logo', where: 'a logo page’s panel' },
  { token: 'SlideTour', title: 'Slide', where: 'a slide page’s panel' },
  { token: 'InfographicTour', title: 'Infographic', where: 'an infographic page’s panel' },
  { token: 'ArticleTour', title: 'Article', where: 'an article page’s panel' },
  { token: 'SankeyFlowsTour', title: 'Sankey Flows', where: 'a Sankey’s Flows dialog' },
  { token: 'TabStyleTour', title: 'Tab Style', where: 'the Tab Style dialog' },
] as const;

export const SHOW_ME_TOURS_STARTED = chart(
  'UI',
  'Started',
  'Show Me Tours Started',
  'Show Me pressed, on any surface.',
  { types: SHOW_ME_SURFACES.map((s) => s.token) },
);

export const SHOW_ME_TOURS_BY_SURFACE: Metric[] = SHOW_ME_SURFACES.map((s) =>
  chart('UI', 'Started', `${s.title} Tours Started`, `Show Me pressed in ${s.where}.`, {
    types: [s.token],
  }),
);

export const SHOW_ME_TOURS_COMPLETED = chart(
  'UI',
  'Ended',
  'Show Me Tours Completed',
  'A Show Me tour run to its end.',
  { types: SHOW_ME_SURFACES.map((s) => `${s.token}Completed`) },
);

export const SHOW_ME_TOURS_SKIPPED = chart(
  'UI',
  'Ended',
  'Show Me Tours Skipped',
  'A Show Me tour closed before its end.',
  { types: SHOW_ME_SURFACES.map((s) => `${s.token}Skipped`), rising: 'neutral' },
);

export const SHOW_ME_TOURS: MetricStack = {
  stack: true,
  title: 'Show Me Tours',
  blurb: 'Show Me, on every surface that has one: started, finished or skipped.',
  members: [
    SHOW_ME_TOURS_STARTED,
    ...SHOW_ME_TOURS_BY_SURFACE,
    SHOW_ME_TOURS_COMPLETED,
    SHOW_ME_TOURS_SKIPPED,
  ],
  headline: SHOW_ME_TOURS_STARTED,
};

// Every guided tour in one Dashboard stack, one line per tour started (docs/specs/017-telemetry/telemetry.md).
// Ten tour stacks took most of the Visitors group; each tour's own funnel is in Pages & Help's
// Tours & Prompts section, which this links to.
export const ONBOARDING_TOURS: MetricStack = {
  stack: true,
  title: 'Onboarding Tours',
  blurb:
    'Every guided tour started, one line per tour. How far people get through each one is in Pages & Help.',
  members: [PAGES_TOURS_STARTED, ELEMENT_TOURS_STARTED, SHOW_ME_TOURS_STARTED],
  seeAlso: { section: 'tours', label: 'See Each Tour in Pages & Help' },
};

// The once-ever power user mode offer (docs/specs/007-editor/power-user-mode.md), as a funnel.
export const POWER_USER_OFFER_ACCEPTED = chart(
  'UI',
  'Used',
  'Power User Offer Accepted',
  'Try It, pressed on the power user mode offer.',
  { types: ['PowerUserOffer'] },
);

export const POWER_USER_OFFER_DECLINED = chart(
  'UI',
  'Declined',
  'Power User Offer Declined',
  'No Thanks, or the power user mode offer closed.',
  { types: ['PowerUserOffer'], rising: 'neutral' },
);

export const POWER_USER_OFFER: MetricStack = {
  stack: true,
  title: 'Power User Offer',
  blurb: 'The one-time offer of power user mode: shown, then accepted or declined.',
  members: [POWER_USER_OFFERED, POWER_USER_OFFER_ACCEPTED, POWER_USER_OFFER_DECLINED],
  headline: POWER_USER_OFFER_ACCEPTED,
};

// The new version prompt (docs/specs/016-platform/new-version-prompt.md): offered, then reloaded.
export const NEW_VERSION_RELOADED = chart(
  'UI',
  'Used',
  'New Version Reloaded',
  'Reload, pressed on the new version prompt.',
  { types: ['NewVersionPrompt'] },
);

export const NEW_VERSION_PROMPT: MetricStack = {
  stack: true,
  title: 'New Version Prompt',
  blurb:
    'Editors left open across a deploy that changed the document format: offered a reload, then reloaded.',
  members: [NEW_VERSION_OFFERED, NEW_VERSION_RELOADED],
  headline: NEW_VERSION_RELOADED,
};

// Sign-in prompts, by where each one happens (docs/specs/014-identity/sign-in-encouragement.md). The same bottom
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
  seeAlso: { section: 'pages', label: 'See Every Page in Pages & Help' },
};

// The landing funnel (docs/specs/019-marketing/landing-funnel.md): arrivals at /new from a public page's call
// to action, and the documents those visits created. The Pages tab splits them
// by page and button against the page views before them.
export const CTA_ARRIVALS = chart(
  'Cta',
  'Opened',
  'CTA Arrivals',
  'Somebody followed a call to action on a public page (the landing page, a feature or comparison page, the help centre) and reached the New Document page.',
);

export const CTA_DOCUMENTS = chart(
  'Cta',
  'Created',
  'Documents from CTAs',
  'Of those arrivals, the visits that went on to create a document. Counted once per arrival.',
);

export const CALLS_TO_ACTION: MetricStack = {
  stack: true,
  title: 'Calls to Action',
  blurb:
    'How the public pages turn visitors into documents: arrivals from a call to action, and the documents they created.',
  members: [CTA_ARRIVALS, CTA_DOCUMENTS],
  headline: CTA_DOCUMENTS,
  seeAlso: { section: 'pages', label: 'See the Landing Funnel in Pages & Help' },
};
