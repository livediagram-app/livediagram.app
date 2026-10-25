// The help home page's structure (docs/specs/018-help/help-pages.md "Home page"): which categories each section
// shows, in order, and the popular topics under the search. The layout is the product's (its lib/home-sections.ts);
// the shape, and the check that holds it to the registry, are the same for every product.

export interface HomeSection {
  /** Anchor id and React key. */
  id: string;
  /** The small uppercase label above the heading. */
  eyebrow: string;
  heading: string;
  lede: string;
  /** Category slugs, in the order the section shows them. */
  categories: string[];
}

export interface HelpHomeLayout {
  /** The category sections between the hero and the closing band, top to bottom. */
  sections: readonly HomeSection[];
  /** The Start here section: the walkthrough's category, its numbered steps, and the cards beside it. The steps
   *  are either how many of the walkthrough's first guides to show, or the guides themselves by
   *  `categorySlug/slug`, for a product whose best first reads sit in other categories. */
  startHere: { walkthrough: string; steps: number | readonly string[]; beside: readonly string[] };
  /** The closing band: the category beside the Contact route. */
  stillStuck: { category: string; contact: string };
  /** The chips under the hero's search: the articles most readers come for, by `categorySlug/slug`. */
  popular: readonly { label: string; path: string }[];
}

/** Every category slug the home page shows, in page order. */
export function homeCategorySlugs(home: HelpHomeLayout): string[] {
  return [
    home.startHere.walkthrough,
    ...home.startHere.beside,
    ...home.sections.flatMap((s) => s.categories),
    home.stillStuck.category,
    home.stillStuck.contact,
  ];
}
