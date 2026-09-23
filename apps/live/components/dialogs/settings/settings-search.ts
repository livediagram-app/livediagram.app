import type { SettingsCategorySpec, SettingsRowSpec } from './settings-catalogue';

// Search across the settings catalogue (spec/20). Pure, so the matching rules
// are testable without rendering a dialog.
//
// Now that every preference lives here, the list is long enough that browsing
// eight categories is the slow path for someone who already knows roughly
// what they want. Search collapses that: type "dark", get Theme.
//
// A row's haystack deliberately includes its CATEGORY and SECTION labels as
// well as its own text, so "privacy" finds the telemetry row and "layers"
// finds all three layer rows, without either word appearing in the row's own
// label. `keywords` carries the synonyms a reader is likely to reach for but
// which the UI never says, "dark mode" for Theme, "transparency" for panel
// opacity, "hotkey" for shortcuts: the same trick the help registry uses.

export type SettingsSearchCategory = SettingsCategorySpec & { matchCount: number };

export type SettingsSearchResult = {
  // True once the query is worth filtering on. A one-character query matches
  // almost everything, so it would flash the whole list into "results" and
  // teach the reader nothing.
  searching: boolean;
  categories: SettingsSearchCategory[];
  totalMatches: number;
};

const MIN_QUERY = 2;

function haystack(row: SettingsRowSpec, category: SettingsCategorySpec): string {
  return [category.label, row.section ?? '', row.label, row.description, row.keywords ?? '']
    .join(' ')
    .toLowerCase();
}

function terms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function searchSettings(
  categories: SettingsCategorySpec[],
  query: string,
): SettingsSearchResult {
  const parts = terms(query);
  if (query.trim().length < MIN_QUERY || parts.length === 0) {
    return {
      searching: false,
      categories: categories.map((c) => ({ ...c, matchCount: 0 })),
      totalMatches: 0,
    };
  }

  // EVERY term must match, so a second word narrows rather than widens, the
  // behaviour a reader expects from a search box, and the one that makes
  // "layer hover" useful.
  const matched = categories.map((category) => {
    const rows = category.rows.filter((row) => {
      const text = haystack(row, category);
      return parts.every((part) => text.includes(part));
    });
    return { ...category, rows, matchCount: rows.length };
  });

  return {
    searching: true,
    categories: matched,
    totalMatches: matched.reduce((sum, c) => sum + c.matchCount, 0),
  };
}

// The category a search should land on: the first with any matches. Keeps the
// desktop pane from sitting empty beside a rail full of badges when the
// category that happened to be selected is not one of the hits.
//
// DESKTOP ONLY: the caller must not apply this on a phone, where there is no
// pane until the reader taps one, so following the results would push a
// category open mid-typing and hide the very badges they are scanning.
export function firstMatchingCategory(
  result: SettingsSearchResult,
  selectedId: string | null,
): string | null {
  if (!result.searching) return selectedId;
  const current = result.categories.find((c) => c.id === selectedId);
  if (current && current.matchCount > 0) return selectedId;
  return result.categories.find((c) => c.matchCount > 0)?.id ?? null;
}
