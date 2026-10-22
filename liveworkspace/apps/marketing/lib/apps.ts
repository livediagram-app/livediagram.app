// The page's own words for each app (liveworkspace/docs/marketing-site.md "The apps"): what the card
// says beyond the shared name and pitch in @liveworkspace/sites. Keyed by site, and a test requires a
// row for every app, so a new app can't ship with an empty card.

import { APP_SITES, type Site, type SiteId } from '@liveworkspace/sites';

export type AppCopy = {
  // One sentence for the card, longer than the pitch.
  summary: string;
  // Three things the app does, each a few words.
  highlights: [string, string, string];
  // Which drawing the card shows.
  art: 'diagram' | 'board';
  // Where its privacy policy lives.
  privacy: string;
};

export const APP_COPY: Partial<Record<SiteId, AppCopy>> = {
  'livediagram.app': {
    summary:
      'A real-time canvas for diagrams, whiteboards, mind maps, infographics and documents, for teams who think visually.',
    highlights: ['Diagrams and whiteboards', 'Mind maps and infographics', 'Pages and slides'],
    art: 'diagram',
    privacy: 'https://livediagram.app/help/policies/privacy-policy/',
  },
  'liveplanner.app': {
    summary:
      'Boards of cards, spreadsheets, dashboards and forms in one project, planned together and shared with one link.',
    highlights: ['Boards of cards', 'Sheets and dashboards', 'Forms that fill the plan'],
    art: 'board',
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
