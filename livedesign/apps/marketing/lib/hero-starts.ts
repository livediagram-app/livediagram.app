import { templateQueryWords, type TemplateKind } from '@livedesign/templates';
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
// words, then the catalogue's order. "app" puts Mobile App Wireframe ahead of a blank phone wireframe found by its words.
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
// HTML (no script) shows this opening hand, left to right: all five from a laptop's width up, the middle
// three on a phone.
export const HERO_FAN_OPENING: readonly TemplateKind[] = [
  'wireframe-tablet-app',
  'wireframe-mobile-app',
  'logo-design',
  'wireframe-website',
  'wireframe-watch-app',
];

// How many cards the fan holds at once: fewer than the pool, so there is always another template to deal in.
export const HERO_FAN_SLOTS = 5;

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

// A curated kind's descriptor (its title, description and category), from the same catalogue.
export function heroTemplate(kind: TemplateKind): HeroMatch {
  const t = ALL.find((m) => m.kind === kind);
  if (!t) throw new Error(`hero template not listed: ${kind}`);
  return t;
}

// The moodboard round the hero's card from `xl` (components/HeroBoard.tsx): six cards from the same pool,
// three a side. The static HTML shows this opening hand, top to bottom down the left then the right; once
// script runs this visit's shuffle replaces it, and then it holds still.
export const HERO_BOARD_SLOTS = 6;
export const HERO_BOARD_OPENING: readonly TemplateKind[] = [
  'logo-design',
  'wireframe-mobile-app',
  'photo-edit',
  'wireframe-website',
  'wireframe-tablet-app',
  'wireframe-dashboard',
];

// This visit's six: the first HERO_BOARD_SLOTS of a shuffled pool (fewer if the pool is smaller).
export function boardHand(random: () => number): TemplateKind[] {
  return shuffleFan(random).slice(0, HERO_BOARD_SLOTS);
}
