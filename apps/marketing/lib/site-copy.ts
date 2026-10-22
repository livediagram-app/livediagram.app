// What liveplanner is, in the words the marketing site's own surfaces use (docs/specs/019-marketing/marketing-site.md
// "SEO and metadata"): the landing page's title, its description (also the web app manifest's), and the
// one-line pitch the home share card and its alt text carry. Kept here, beside the pages, so the metadata says
// what the landing page says: a planner of boards, sheets, dashboards and forms, worked on together.

export const MARKETING_TITLE = 'liveplanner: Plan the work together, live';

export const MARKETING_DESCRIPTION =
  'Free planning in real time, with no trackers: boards of cards, spreadsheets, dashboards and forms in one project, shared with one link. No sign-up to start.';

// Lower case: it follows "liveplanner: " in the share images' alt text.
export const MARKETING_PITCH =
  'boards, sheets, dashboards and forms, planned together in real time';

// The pitch as a sentence, for the share card's subtitle.
export const MARKETING_PITCH_SENTENCE = `${MARKETING_PITCH[0]!.toUpperCase()}${MARKETING_PITCH.slice(1)}.`;
