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
  // The accent's deep shade (its brand-700), for filled buttons and text: white on it, and it on
  // white, pass WCAG AA, which the brand-500 accent does not.
  deep: string;
  // A line naming what the app is for, the heading of its section on the page.
  tagline: string;
  // The card's button, a verb for the work the app is for ("Start Planning").
  action: string;
};

export const APP_COPY: Partial<Record<SiteId, AppCopy>> = {
  'livediagram.app': {
    summary:
      'A real-time canvas for diagrams, whiteboards and mind maps, for teams who think visually.',
    highlights: ['Diagrams and flowcharts', 'Whiteboards and sketches', 'Mind maps'],
    art: 'diagram',
    deep: '#0369a1',
    tagline: 'Think it through, together.',
    action: 'Start Diagramming',
  },
  'liveplanner.app': {
    summary:
      'Boards of cards, spreadsheets, dashboards and forms in one project, planned together and shared with one link.',
    highlights: ['Boards of cards', 'Sheets and dashboards', 'Forms that fill the plan'],
    art: 'board',
    deep: '#6d28d9',
    tagline: 'Turn it into a plan.',
    action: 'Start Planning',
  },
  'livedocuments.app': {
    summary:
      'Articles, slides and infographics that lay themselves out on real pages, written together and presented from the same link.',
    highlights: ['Articles and reports', 'Slides you can present', 'Infographics and Markdown'],
    art: 'document',
    deep: '#b45309',
    tagline: 'Write it up, beautifully.',
    action: 'Start Writing',
  },
  'livedesign.app': {
    summary:
      'Logos, wireframes and photo editing on artboards, designed together and exported when they are ready.',
    highlights: ['Logos and brand marks', 'Wireframes for sites and apps', 'Photo editing'],
    art: 'design',
    deep: '#be123c',
    tagline: 'Make it look right.',
    action: 'Start Designing',
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
