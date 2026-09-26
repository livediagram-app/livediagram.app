# Register a help article

The help centre (`apps/help`, [Help app](../specs/018-help/help-app.md)) has a hand-curated registry in the [`@livediagram/help-registry`](../../packages/help-registry/src/index.ts) package (re-exported by `apps/help/lib/articles.ts` so the help app keeps its `@/lib/articles` import path). It is the **single source for the help search** (`SearchInput` → `searchArticles`), **the category/browse listings**, **and the live editor's search-panel Help group** (`apps/live/lib/help-search.ts` derives its catalogue from it). The article's MDX page renders from the filesystem, but it is **invisible to search and browse unless it's in that registry**: there is no filesystem auto-discovery.

A new article that isn't registered is a bug, the same way an out-of-date spec is. Follow these steps whenever you add, remove or rename a help article, all **in the same change**.

## Steps

1. Write (or move, or delete) the article's `apps/help/app/.../page.mdx`.
2. Add (or update, or remove) its entry in the `articles` array in `packages/help-registry/src/index.ts`: `slug`, `title`, `description`, `keywords`, `category`, `categorySlug` (the full nested path, e.g. `canvas/the-canvas`), and `parentSlug` for a sub-article.
3. Check `categorySlug`/`slug` match the `page.mdx` path, so the search result link resolves.
4. Write the registry `description` as the **short search-card summary**. It is intentionally separate from the MDX `helpMetadata` description (the longer SEO/OG meta): write a concise one, don't just copy the meta.
5. Write `keywords` (**required**): space-separated, lowercase search synonyms, the words a user would type when they don't know the title ("transparency" for opacity, "hotkey" for keyboard shortcuts), plus adjacent spellings ("color" beside "colour"). Both the help search and the editor's search panel match on them; a test fails if they're missing.
6. Bump the matching `categories[].articleCount`, and add a `categories` entry if it's a brand-new top-level category.
7. **Draw the card.** For an article in one of the ten **feature** categories, add an entry to BOTH `FEATURE_ICONS` (`apps/help/lib/featureIcons.tsx`) and `FEATURE_ENTITY_HEX` (`apps/help/lib/featureColours.ts`); for a **support** category, add one to `SUPPORT_ARTICLE_ICONS` (`apps/help/lib/articleIcons.tsx`), which needs no hue. Getting Started is the exception: its cards lead with a numbered step badge instead of an icon.
8. Draw what the card is _about_ (house style in [Help app](../specs/018-help/help-app.md)), and check the result doesn't land on a glyph either set already uses. A card with no entry silently falls back to a shared glyph and looks like every other undrawn card, which nothing at runtime can notice.
9. Run the help tests (`pnpm --filter @livediagram/help test`): `feature-icons.test.ts` / `article-icons.test.ts` keep every card drawn, and the registry tests keep keywords and paths honest.
