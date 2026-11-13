// A start's Best Match (docs/specs/007-editor/start-diagramming.md, start-panel.md in liveplanner, "A title match leads"): the cards whose name begins
// with what was typed, case, punctuation and hyphens ignored as the search's own, lifted out of their groups to lead the
// results. An exact name comes first, then a longer one, each otherwise in the order the groups list them. A card may
// also name words that lead it as an exact name would, typed whole (its `bestFor`: a planner's Describe a Plan for
// "ai"). Pure: the panel draws what this returns.

// Punctuation and hyphens are no part of a word, as in the template search (template-search.ts): "to-do" reads as
// "to do" and as "todo", so either typed finds the other.
const PUNCTUATION = /[^\p{L}\p{N}\s]+/gu;
const spaced = (s: string): string =>
  s.toLowerCase().replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
const joined = (s: string): string => s.toLowerCase().replace(PUNCTUATION, '').replace(/\s+/g, '');

/** How a name answers a query: 0 an exact name, 1 a name that begins with it, null neither. */
function titleMatch(name: string, query: string): 0 | 1 | null {
  const q = spaced(query);
  if (q === '') return null;
  const n = spaced(name);
  const qj = joined(query);
  const nj = joined(name);
  if (n === q || nj === qj) return 0;
  return n.startsWith(q) || nj.startsWith(qj) ? 1 : null;
}

// A card's rank: its name's, else exact for a `bestFor` word typed whole.
function rankOf(card: { name: string; bestFor?: readonly string[] }, query: string): 0 | 1 | null {
  const rank = titleMatch(card.name, query);
  if (rank !== null || !card.bestFor) return rank;
  const q = spaced(query);
  return card.bestFor.some((w) => spaced(w) === q) ? 0 : null;
}

/** The results with the Best Match lifted out: `best` the cards whose name begins with the query (exact first, a
 *  `bestFor` word as exact), and `groups` the rest, each group less those cards, an emptied group dropped. */
export function liftBestMatch<
  C extends { id: string; name: string; bestFor?: readonly string[] },
  G extends { cards: readonly C[] },
>(groups: readonly G[], query: string): { best: C[]; groups: G[] } {
  const ranked: { card: C; rank: 0 | 1; at: number }[] = [];
  const lifted = new Set<string>();
  let at = 0;
  for (const g of groups)
    for (const card of g.cards) {
      const rank = rankOf(card, query);
      if (rank !== null && !lifted.has(card.id)) {
        ranked.push({ card, rank, at });
        lifted.add(card.id);
      }
      at += 1;
    }
  if (ranked.length === 0) return { best: [], groups: [...groups] };
  ranked.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return {
    best: ranked.map((r) => r.card),
    groups: groups
      .map((g) => ({ ...g, cards: g.cards.filter((c) => !lifted.has(c.id)) }))
      .filter((g) => g.cards.length > 0),
  };
}
