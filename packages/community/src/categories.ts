import type { CommunityApp } from './apps';

// Each app's closed set of categories (liveworkspace/docs/specs/007-community/community.md "Categories"): exactly its
// Start With template categories (each product's TEMPLATE_CATEGORIES in <product>/packages/templates/src/
// template-categories.ts: the same ids, labels and order, each blurb its description), then Something Else. So a post
// is filed where the app's own template picker files its templates, and Start With can show the Community's best
// beside them. Each product's templates package pins its list to its TEMPLATE_CATEGORIES (community-categories
// test), so the two cannot drift.
//
// One service holds every app's posts, and each gallery filters by its own app's set, so a post's category must be one
// of its app's. Ids repeat across apps with different meanings and labels (`meetings` is livediagram's Meetings &
// Workshops and liveplanner's Meetings), so a label, a blurb and a telemetry type are looked up by app and id.

export type CommunityCategoryDef = {
  // Stored on the post.
  id: string;
  // Shown on cards, filters, the publish dialog's chips and Start With's rail.
  label: string;
  // The one line the publish dialog shows for the chosen category: the template category's description.
  blurb: string;
  // The telemetry value (PascalCase, never content).
  type: string;
};

const OTHER = {
  id: 'other',
  label: 'Something Else',
  blurb: 'Anything that fits nowhere above.',
  type: 'Other',
} as const;

export const COMMUNITY_APP_CATEGORIES = {
  'livediagram.app': [
    {
      id: 'ideas',
      label: 'Brainstorming',
      blurb: 'Mind maps and boards for getting ideas out.',
      type: 'Ideas',
    },
    {
      id: 'decisions',
      label: 'Decisions',
      blurb: 'Priorities, trade-offs, risks and root causes.',
      type: 'Decisions',
    },
    {
      id: 'goals',
      label: 'Goals & Metrics',
      blurb: 'OKRs, metric trees, funnels and growth loops.',
      type: 'Goals',
    },
    {
      id: 'meetings',
      label: 'Meetings & Workshops',
      blurb: 'Agendas, Q&A and formats for running a session.',
      type: 'Meetings',
    },
    {
      id: 'people',
      label: 'People & Teams',
      blurb: 'Org charts, roles, onboarding and family trees.',
      type: 'People',
    },
    {
      id: 'planning',
      label: 'Planning',
      blurb: 'Gantt charts, roadmaps and timelines of work.',
      type: 'Planning',
    },
    {
      id: 'processes',
      label: 'Processes & Workflows',
      blurb: 'Flowcharts and workflows for how work gets done.',
      type: 'Processes',
    },
    {
      id: 'product',
      label: 'Product & UX',
      blurb: 'Prototypes, personas, journeys and discovery.',
      type: 'Product',
    },
    {
      id: 'games',
      label: 'Quizzes & Games',
      blurb: 'Quizzes, icebreakers and games for the room.',
      type: 'Games',
    },
    {
      id: 'retros',
      label: 'Retrospectives',
      blurb: 'Look back as a team and agree what to change.',
      type: 'Retros',
    },
    {
      id: 'software',
      label: 'Software & IT',
      blurb: 'Architecture, data, networks and incidents.',
      type: 'Software',
    },
    {
      id: 'strategy',
      label: 'Strategy',
      blurb: 'Frameworks for where the business stands and goes.',
      type: 'Strategy',
    },
    {
      id: 'learning',
      label: 'Teaching & Learning',
      blurb: 'Concept maps, KWL charts and visual notes.',
      type: 'Learning',
    },
    {
      id: 'spaces',
      label: 'Virtual Spaces',
      blurb: 'Offices and halls to walk round as an avatar.',
      type: 'Spaces',
    },
    OTHER,
  ],
  'liveplanner.app': [
    {
      id: 'support',
      label: 'Customer Support',
      blurb: 'Tickets, contact forms and what customers say.',
      type: 'Support',
    },
    {
      id: 'education',
      label: 'Education',
      blurb: 'Study plans, coursework and a class grade book.',
      type: 'Education',
    },
    {
      id: 'events',
      label: 'Events',
      blurb: 'Plans, guest lists and RSVPs for any occasion.',
      type: 'Events',
    },
    {
      id: 'finance',
      label: 'Finance',
      blurb: 'Budgets, invoices, expenses, loans and stock.',
      type: 'Finance',
    },
    {
      id: 'hiring',
      label: 'Hiring and People',
      blurb: 'Open roles, candidates and their first month.',
      type: 'Hiring',
    },
    {
      id: 'marketing',
      label: 'Marketing',
      blurb: 'Content and launches, planned to the day.',
      type: 'Marketing',
    },
    {
      id: 'meetings',
      label: 'Meetings',
      blurb: 'Agendas, retros and the actions they lead to.',
      type: 'Meetings',
    },
    {
      id: 'personal',
      label: 'Personal',
      blurb: 'Your week, goals, habits and household money.',
      type: 'Personal',
    },
    {
      id: 'product',
      label: 'Product and Engineering',
      blurb: 'Sprints, bugs and feedback for product teams.',
      type: 'Product',
    },
    {
      id: 'planning',
      label: 'Projects and Teams',
      blurb: 'Boards, trackers and goals that keep teams moving.',
      type: 'Planning',
    },
    {
      id: 'sales',
      label: 'Sales',
      blurb: 'Deals, contacts and the forecast they add up to.',
      type: 'Sales',
    },
    OTHER,
  ],
  'livedocuments.app': [
    {
      id: 'careers',
      label: 'Careers',
      blurb: 'Résumés and cover letters for the next job.',
      type: 'Careers',
    },
    {
      id: 'events',
      label: 'Events',
      blurb: 'Posters, group cards and toasts for big days.',
      type: 'Events',
    },
    { id: 'home', label: 'Home', blurb: 'Recipes to share and floor plans of a home.', type: 'Home' },
    {
      id: 'learning',
      label: 'Learning',
      blurb: 'Lesson plans, class slides and school talks.',
      type: 'Learning',
    },
    {
      id: 'marketing',
      label: 'Marketing',
      blurb: 'Social posts, explainers, ads and comparisons.',
      type: 'Marketing',
    },
    {
      id: 'pitches',
      label: 'Pitches',
      blurb: 'Decks and cue cards to pitch or launch an idea.',
      type: 'Pitches',
    },
    { id: 'plans', label: 'Plans', blurb: 'Briefs, proposals, PR/FAQs and design docs.', type: 'Plans' },
    {
      id: 'reports',
      label: 'Reports',
      blurb: 'Status reports, reviews and stories in numbers.',
      type: 'Reports',
    },
    {
      id: 'speeches',
      label: 'Talks',
      blurb: 'Cue cards for talks, toasts and presentations.',
      type: 'Speeches',
    },
    {
      id: 'team',
      label: 'Teams',
      blurb: 'Meeting notes, workshops and welcomes for a team.',
      type: 'Team',
    },
    OTHER,
  ],
  'livedesign.app': [
    {
      id: 'branding',
      label: 'Branding',
      blurb: 'Logos, wordmarks, emblems and app icons.',
      type: 'Branding',
    },
    {
      id: 'health',
      label: 'Health and Fitness',
      blurb: 'Workouts, heart rate and activity on the wrist.',
      type: 'Health',
    },
    {
      id: 'media',
      label: 'Music and Video',
      blurb: 'Music, podcast and video players, and galleries.',
      type: 'Media',
    },
    {
      id: 'photos',
      label: 'Photos',
      blurb: 'Photo edits, retouches and layered pictures.',
      type: 'Photos',
    },
    {
      id: 'shopping',
      label: 'Shopping',
      blurb: 'Stores, carts, checkouts and order tracking.',
      type: 'Shopping',
    },
    {
      id: 'onboarding',
      label: 'Sign Up and Onboarding',
      blurb: 'First runs: welcome, sign up, verify, permissions.',
      type: 'Onboarding',
    },
    {
      id: 'social',
      label: 'Social and Messaging',
      blurb: 'Feeds, stories, posts, chat and profiles.',
      type: 'Social',
    },
    {
      id: 'travel',
      label: 'Travel and Transport',
      blurb: 'Flights, boarding passes, maps and rides.',
      type: 'Travel',
    },
    {
      id: 'websites',
      label: 'Websites',
      blurb: 'Landing pages, blogs, stores and help sites.',
      type: 'Websites',
    },
    {
      id: 'work',
      label: 'Work and Productivity',
      blurb: 'Dashboards, boards, tasks, calendars and inboxes.',
      type: 'Work',
    },
    OTHER,
  ],
  // A product for meeting in Spaces (livehuddle/docs/specs/025-community/community.md "Categories").
  'livehuddle.app': [
    {
      id: 'campus',
      label: 'Campus',
      blurb: 'Whole sites: offices, halls and bars in a garden.',
      type: 'Campus',
    },
    {
      id: 'events',
      label: 'Events',
      blurb: 'Halls and rooms for talks, demos and training.',
      type: 'Events',
    },
    {
      id: 'office',
      label: 'Office',
      blurb: 'Desks, pods and meeting rooms for the workday.',
      type: 'Office',
    },
    {
      id: 'outdoor',
      label: 'Outdoor',
      blurb: 'Gardens and parks to meet in under an open sky.',
      type: 'Outdoor',
    },
    {
      id: 'recreation',
      label: 'Recreation',
      blurb: 'Bars and cafes to unwind in together after work.',
      type: 'Recreation',
    },
    OTHER,
  ],
} as const satisfies Record<CommunityApp, readonly CommunityCategoryDef[]>;

type AppCategories = typeof COMMUNITY_APP_CATEGORIES;

// Every app's category ids, together: what a stored or queried category can be. Spelled out, not derived from the
// five lists: the products' OpenAPI schemas are generated from these types, and the generator can't read an indexed
// access over a union of tuples. categories.test.ts checks the two agree.
export type CommunityCategory =
  | 'branding'
  | 'campus'
  | 'careers'
  | 'decisions'
  | 'education'
  | 'events'
  | 'finance'
  | 'games'
  | 'goals'
  | 'health'
  | 'hiring'
  | 'home'
  | 'ideas'
  | 'learning'
  | 'marketing'
  | 'media'
  | 'meetings'
  | 'office'
  | 'onboarding'
  | 'other'
  | 'outdoor'
  | 'people'
  | 'personal'
  | 'photos'
  | 'pitches'
  | 'planning'
  | 'plans'
  | 'processes'
  | 'product'
  | 'recreation'
  | 'reports'
  | 'retros'
  | 'sales'
  | 'shopping'
  | 'social'
  | 'software'
  | 'spaces'
  | 'speeches'
  | 'strategy'
  | 'support'
  | 'team'
  | 'travel'
  | 'websites'
  | 'work';

/** The ids the five lists hold, for the check that CommunityCategory names exactly them. */
export type CommunityAppCategoryId = AppCategories[CommunityApp][number]['id'];

/** The category ids an app offers. */
export type CommunityCategoryOf<A extends CommunityApp> = AppCategories[A][number]['id'];

// One app's categories, in display order.
export function communityCategories<A extends CommunityApp>(app: A): AppCategories[A] {
  return COMMUNITY_APP_CATEGORIES[app];
}

// Every id any app offers.
const ANY_APP: ReadonlySet<string> = new Set(
  Object.values(COMMUNITY_APP_CATEGORIES).flatMap((list: readonly CommunityCategoryDef[]) =>
    list.map((c) => c.id),
  ),
);

// Each app's categories by id.
const BY_APP = new Map(
  (Object.keys(COMMUNITY_APP_CATEGORIES) as CommunityApp[]).map((app) => [
    app,
    new Map(
      (COMMUNITY_APP_CATEGORIES[app] as readonly CommunityCategoryDef[]).map((c) => [c.id, c]),
    ),
  ]),
);

// Any app's category: what a query or a stored row may name. A post's own must also be its app's
// (`isCommunityCategoryOf`).
export function isCommunityCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && ANY_APP.has(value);
}

export function isCommunityCategoryOf(
  app: CommunityApp,
  value: unknown,
): value is CommunityCategory {
  return typeof value === 'string' && BY_APP.get(app)!.has(value);
}

// An app's category by id. A category the app does not offer (a retired id, another app's) is Something Else, as a
// stored post with one reads (rows.ts `rowCategory`).
export function communityCategoryOf(app: CommunityApp, id: string): CommunityCategoryDef {
  return BY_APP.get(app)!.get(id) ?? OTHER;
}

export function communityCategoryLabel(app: CommunityApp, id: string): string {
  return communityCategoryOf(app, id).label;
}

export function communityCategoryType(app: CommunityApp, id: string): string {
  return communityCategoryOf(app, id).type;
}

// One app's telemetry types (`Community·Shared|Changed·<Type>`), as a list.
export function communityCategoryTypes(app: CommunityApp): readonly string[] {
  return (COMMUNITY_APP_CATEGORIES[app] as readonly CommunityCategoryDef[]).map((c) => c.type);
}
