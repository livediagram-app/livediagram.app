// The page's own words for each app (liveworkspace/docs/site.md "The apps"): what the card
// says beyond the shared name and pitch in @liveworkspace/sites. Keyed by site, and a test requires a
// row for every app, so a new app can't ship with an empty card.

import { APP_SITES, type Site, type SiteId } from '@liveworkspace/sites';

// The drawing of each app's work on the home page (components/landing/AppWindow.tsx).
export type AppArt = 'diagram' | 'board' | 'document' | 'design';

export type AppCopy = {
  // One sentence for the card, longer than the pitch.
  summary: string;
  // Three things the app does, each a few words.
  highlights: [string, string, string];
  // Which drawing the card shows.
  art: AppArt;
  // Where its privacy policy lives.
  privacy: string;
  // The accent's deep shade (its brand-700), for filled buttons and text: white on it, and it on
  // white, pass WCAG AA, which the brand-500 accent does not.
  deep: string;
  // A line naming what the app is for, the heading of its section on the page.
  tagline: string;
};

export const APP_COPY: Partial<Record<SiteId, AppCopy>> = {
  'livediagram.app': {
    summary:
      'A real-time canvas for diagrams, whiteboards, mind maps, infographics and documents, for teams who think visually.',
    highlights: ['Diagrams and whiteboards', 'Mind maps and infographics', 'Pages and slides'],
    art: 'diagram',
    deep: '#0369a1',
    tagline: 'Think it through, together.',
    privacy: 'https://livediagram.app/help/policies/privacy-policy/',
  },
  'liveplanner.app': {
    summary:
      'Boards of cards, spreadsheets, dashboards and forms in one project, planned together and shared with one link.',
    highlights: ['Boards of cards', 'Sheets and dashboards', 'Forms that fill the plan'],
    art: 'board',
    deep: '#6d28d9',
    tagline: 'Turn it into a plan.',
    privacy: 'https://liveplanner.app/help/policies/privacy-policy/',
  },
};

export type ListedApp = Site & AppCopy;

// Every app the page lists, in the shared order, with its copy.
export function listedApps(): ListedApp[] {
  return APP_SITES.flatMap((site) => {
    const copy = APP_COPY[site.id];
    return copy ? [{ ...site, ...copy }] : [];
  });
}

// The apps on their way (liveworkspace/docs/site.md "The front door"). The home page gives each a
// section marked Coming soon, with no way in yet. They join `@liveworkspace/sites` (and with it every
// logo's switcher, the footer and the open buttons) when they ship.
export type UpcomingApp = Omit<AppCopy, 'privacy'> & {
  // The wordmark, lower case like the logos.
  name: string;
  // Where it will live.
  domain: string;
  // Its brand-500.
  accent: string;
};

export const UPCOMING_APPS: readonly UpcomingApp[] = [
  {
    name: 'livedocuments',
    domain: 'livedocuments.app',
    accent: '#f59e0b',
    deep: '#b45309',
    tagline: 'Write it up, beautifully.',
    summary:
      'Articles, slides and infographics that lay themselves out on real pages, written together and presented from the same link.',
    highlights: ['Articles and reports', 'Slides you can present', 'Infographics and Markdown'],
    art: 'document',
  },
  {
    name: 'livedesign',
    domain: 'livedesign.app',
    accent: '#f43f5e',
    deep: '#be123c',
    tagline: 'Make it look right.',
    summary:
      'Logos, wireframes and photo editing on artboards, designed together and exported when they are ready.',
    highlights: ['Logos and brand marks', 'Wireframes for sites and apps', 'Photo editing'],
    art: 'design',
  },
];

// Every app the home page shows a section for: the listed apps with their way in, then the ones on
// their way.
export type PageApp = Omit<UpcomingApp, 'domain'> & { domain: string; url: string | null };

export function pageApps(): PageApp[] {
  return [
    ...listedApps().map((app) => ({ ...app, domain: app.id, url: app.url })),
    ...UPCOMING_APPS.map((app) => ({ ...app, url: null })),
  ];
}
