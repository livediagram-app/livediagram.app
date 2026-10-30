import type { CommunityApp } from './apps';

// Each app's closed set of categories (liveworkspace/docs/specs/007-community/community.md "Categories"; each product's
// 025-community spec gives their descriptions). One service holds every app's posts, and each gallery filters by its
// own app's set, so a post's category must be one of its app's. An id two apps share means the same thing in both:
// one label and one telemetry type, so a label or a type is looked up by id alone.

export type CommunityCategoryDef = {
  // Stored on the post.
  id: string;
  // Shown on cards, filters and the publish dialog's chips.
  label: string;
  // The one line the publish dialog shows for the chosen category.
  blurb: string;
  // The telemetry value (PascalCase, never content).
  type: string;
};

const OTHER = {
  id: 'other',
  label: 'Something Else',
  blurb: 'Anything that fits nowhere above',
  type: 'Other',
} as const;

export const COMMUNITY_APP_CATEGORIES = {
  'livediagram.app': [
    {
      id: 'architecture',
      label: 'Architecture',
      blurb: 'Systems, cloud, infrastructure, software',
      type: 'Architecture',
    },
    {
      id: 'flows',
      label: 'Flows & Processes',
      blurb: 'Flowcharts, processes, journeys, state',
      type: 'Flows',
    },
    {
      id: 'planning',
      label: 'Planning',
      blurb: 'Roadmaps, kanban, timelines, gantt',
      type: 'Planning',
    },
    {
      id: 'workshops',
      label: 'Workshops',
      blurb: 'Retrospectives, event storming, brainstorming',
      type: 'Workshops',
    },
    {
      id: 'mindmaps',
      label: 'Mind Maps',
      blurb: 'Mind maps, concept maps, notes',
      type: 'Mindmaps',
    },
    {
      id: 'design',
      label: 'Design & Wireframes',
      blurb: 'Wireframes, mockups, layouts',
      type: 'Design',
    },
    {
      id: 'data',
      label: 'Data & Databases',
      blurb: 'Entity diagrams, schemas, tables',
      type: 'Data',
    },
    {
      id: 'learning',
      label: 'Learning & Teaching',
      blurb: 'Explainers, lessons, study notes',
      type: 'Learning',
    },
    {
      id: 'infographics',
      label: 'Infographics',
      blurb: 'Posters, charts and explainers',
      type: 'Infographics',
    },
    { id: 'art', label: 'Drawing & Art', blurb: 'Sketches, illustrations, Draw mode', type: 'Art' },
    OTHER,
  ],
  'liveplanner.app': [
    {
      id: 'projects',
      label: 'Project Plans',
      blurb: 'Projects, launches, delivery plans',
      type: 'Projects',
    },
    {
      id: 'roadmaps',
      label: 'Roadmaps & Timelines',
      blurb: 'Roadmaps, timelines, Gantts, milestones',
      type: 'Roadmaps',
    },
    {
      id: 'workflows',
      label: 'Kanban & Workflows',
      blurb: 'Kanban boards, pipelines, triage',
      type: 'Workflows',
    },
    {
      id: 'trackers',
      label: 'Trackers & Sheets',
      blurb: 'Trackers, logs, inventories, sheets',
      type: 'Trackers',
    },
    {
      id: 'budgets',
      label: 'Budgets & Finance',
      blurb: 'Budgets, forecasts, expenses',
      type: 'Budgets',
    },
    {
      id: 'events',
      label: 'Events & Schedules',
      blurb: 'Events, rotas, schedules, calendars',
      type: 'Events',
    },
    {
      id: 'forms',
      label: 'Forms & Surveys',
      blurb: 'Forms, surveys, sign-ups, requests',
      type: 'Forms',
    },
    {
      id: 'dashboards',
      label: 'Dashboards & Reports',
      blurb: 'Dashboards, status reports, metrics',
      type: 'Dashboards',
    },
    {
      id: 'personal',
      label: 'Personal & Home',
      blurb: 'Habits, home, travel, study',
      type: 'Personal',
    },
    OTHER,
  ],
  'livedocuments.app': [
    {
      id: 'articles',
      label: 'Articles & Reports',
      blurb: 'Reports, articles, write-ups, white papers',
      type: 'Articles',
    },
    { id: 'decks', label: 'Slide Decks', blurb: 'Talks, pitches, reviews, lessons', type: 'Decks' },
    {
      id: 'infographics',
      label: 'Infographics',
      blurb: 'Posters, charts and explainers',
      type: 'Infographics',
    },
    {
      id: 'guides',
      label: 'Guides & How-Tos',
      blurb: 'Handbooks, onboarding, step-by-step guides',
      type: 'Guides',
    },
    {
      id: 'proposals',
      label: 'Proposals & Briefs',
      blurb: 'Proposals, briefs, plans, one-pagers',
      type: 'Proposals',
    },
    {
      id: 'newsletters',
      label: 'Newsletters & Updates',
      blurb: 'Newsletters, announcements, team updates',
      type: 'Newsletters',
    },
    {
      id: 'learning',
      label: 'Learning & Teaching',
      blurb: 'Explainers, lessons, study notes',
      type: 'Learning',
    },
    OTHER,
  ],
  'livedesign.app': [
    { id: 'logos', label: 'Logos & Branding', blurb: 'Logos, marks, brand kits', type: 'Logos' },
    {
      id: 'wireframes',
      label: 'Wireframes & Mockups',
      blurb: 'Screens, flows, app and web layouts',
      type: 'Wireframes',
    },
    {
      id: 'photos',
      label: 'Photo Edits',
      blurb: 'Retouched photos, composites, collages',
      type: 'Photos',
    },
    {
      id: 'social',
      label: 'Social & Marketing',
      blurb: 'Social posts, banners, ads',
      type: 'Social',
    },
    {
      id: 'posters',
      label: 'Posters & Flyers',
      blurb: 'Posters, flyers, invitations, cards',
      type: 'Posters',
    },
    {
      id: 'illustrations',
      label: 'Icons & Illustrations',
      blurb: 'Icons, illustrations, patterns',
      type: 'Illustrations',
    },
    OTHER,
  ],
} as const satisfies Record<CommunityApp, readonly CommunityCategoryDef[]>;

type AppCategories = typeof COMMUNITY_APP_CATEGORIES;

// Every app's category ids, together: what a stored or queried category can be.
export type CommunityCategory = AppCategories[CommunityApp][number]['id'];

// One app's categories, in display order.
export function communityCategories<A extends CommunityApp>(app: A): AppCategories[A] {
  return COMMUNITY_APP_CATEGORIES[app];
}

// Every category once, by id (a shared id has one label and one type).
const BY_ID: ReadonlyMap<string, CommunityCategoryDef> = new Map(
  Object.values(COMMUNITY_APP_CATEGORIES).flatMap((list: readonly CommunityCategoryDef[]) =>
    list.map((c) => [c.id, c] as const),
  ),
);

// Any app's category: what a query or a stored row may name. A post's own must also be its app's
// (`isCommunityCategoryOf`).
export function isCommunityCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && BY_ID.has(value);
}

export function isCommunityCategoryOf(
  app: CommunityApp,
  value: unknown,
): value is CommunityCategory {
  return (
    typeof value === 'string' &&
    (COMMUNITY_APP_CATEGORIES[app] as readonly CommunityCategoryDef[]).some((c) => c.id === value)
  );
}

export function communityCategoryLabel(id: CommunityCategory): string {
  return BY_ID.get(id)!.label;
}

export function communityCategoryType(id: CommunityCategory): string {
  return BY_ID.get(id)!.type;
}

// One app's telemetry types (`Community·Shared|Changed·<Type>`), as a list.
export function communityCategoryTypes(app: CommunityApp): readonly string[] {
  return (COMMUNITY_APP_CATEGORIES[app] as readonly CommunityCategoryDef[]).map((c) => c.type);
}
