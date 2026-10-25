import { templateQueryWords, type TemplateKind } from '@liveplanner/templates';
import { filterGallery, galleryTemplates, popularTemplates } from '@/lib/template-gallery';

// The hero's ways in (docs/specs/019-marketing/marketing-site.md "Hero"): its template search and its
// card fan. Data and ranking only, so they test without rendering.

// How many matches the search lists under its bar.
export const HERO_SEARCH_LIMIT = 5;

// Every listed template once, blanks first: the gallery's own catalogue, so the hero's search and
// the gallery's can never disagree about what exists.
const ALL = (() => {
  const seen = new Set<string>();
  return [...popularTemplates(), ...galleryTemplates()].filter((t) =>
    seen.has(t.kind) ? false : (seen.add(t.kind), true),
  );
})();

type HeroMatch = (typeof ALL)[number];

// The best matches for a query, by the editor's own search (filterGallery): a template whose title
// holds every typed word ranks before one found only through its description, category or search
// words, then the catalogue's order. "retro" puts Retrospective ahead of a board that mentions one.
export function heroSearch(query: string, limit = HERO_SEARCH_LIMIT): HeroMatch[] {
  const words = templateQueryWords(query);
  if (words.length === 0) return [];
  const inTitle = (t: HeroMatch) => {
    const title = t.title.toLowerCase();
    return words.every((w) => title.includes(w)) ? 0 : 1;
  };
  return filterGallery(ALL, query)
    .map((t, i) => ({ t, i, rank: inTitle(t) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((m) => m.t);
}

// The fan along the hero's foot (components/HeroFan.tsx). It deals from every listed template but the
// blanks, in a fresh random order on each visit, so a visitor keeps seeing something new. The static
// HTML (no script) shows this opening hand, left to right: all seven on a very wide screen
// (HERO_FAN_FULL_MIN_PX), the middle five on a laptop, the middle three on a phone.
export const HERO_FAN_OPENING: readonly TemplateKind[] = [
  'content-calendar',
  'team-retro',
  'project-planner',
  'kanban',
  'budget-planner',
  'rsvp-form',
  'okrs',
];

// How many cards the fan holds at once, and the window width from which all of them show: seven
// full-size cards (14 rem each, 1.25 rem apart, 1 rem padding either side) take 1720 px, and the
// outer two lean out about 35 px each, so below 1800 px the outer pair hides.
export const HERO_FAN_SLOTS = 7;
export const HERO_FAN_FULL_MIN_PX = 1800;

// Every template the fan can deal: the gallery's own catalogue, so it never shows one that is not
// listed.
export const HERO_FAN_POOL: readonly TemplateKind[] = galleryTemplates().map((t) => t.kind);

// The pool in a random order (Fisher-Yates), from the random source given (Math.random in the page).
export function shuffleFan(random: () => number): TemplateKind[] {
  const out = [...HERO_FAN_POOL];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// The next kind to deal from a shuffled `pool` after `from` (an index into it), skipping any already
// showing.
export function nextFanKind(
  pool: readonly TemplateKind[],
  shown: readonly TemplateKind[],
  from: number,
): { kind: TemplateKind; at: number } {
  for (let step = 1; step <= pool.length; step++) {
    const at = (from + step) % pool.length;
    const kind = pool[at]!;
    if (!shown.includes(kind)) return { kind, at };
  }
  return { kind: pool[from]!, at: from };
}

// A curated kind's descriptor (its title and description), from the same catalogue.
export function heroTemplate(kind: TemplateKind): HeroMatch {
  const t = ALL.find((m) => m.kind === kind);
  if (!t) throw new Error(`hero template not listed: ${kind}`);
  return t;
}

// The kanban wall's cards from `xl` (components/HeroKanban.tsx): six from the same pool, in the order
// Backlog top, Backlog below, Done top, Done below, To do's foot, then the card being dragged from Doing.
// The static HTML shows this opening hand; once script runs this visit's shuffle replaces it, and then it
// holds still.
export const HERO_BOARD_SLOTS = 6;
export const HERO_BOARD_OPENING: readonly TemplateKind[] = [
  'kanban',
  'team-retro',
  'okrs',
  'rsvp-form',
  'budget-planner',
  'project-planner',
];

// This visit's six: the first HERO_BOARD_SLOTS of a shuffled pool (fewer if the pool is smaller).
export function boardHand(random: () => number): TemplateKind[] {
  return shuffleFan(random).slice(0, HERO_BOARD_SLOTS);
}
