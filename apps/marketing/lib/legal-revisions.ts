// Last-revised date for the legal pages (/terms and /privacy).
// Single source of truth shared by:
//
//   - app/sitemap.ts (drives `lastModified` for the legal entries),
//   - app/terms/page.tsx + app/privacy/page.tsx (the visible
//     "Last updated <date>" line on each page, rendered by
//     components/LegalPage.tsx).
//
// Previously the date was hardcoded in three places: an ISO Date
// in sitemap.ts and the literal string "31 May 2026" in each of
// the two legal pages. Bumping the date meant editing all three;
// missing the sitemap entry would surface as Google indexing a
// stale `lastModified` while the visible page already showed the
// new date.
//
// Bump LAST_UPDATED_ISO when revising the legal copy. The visible
// display string + the sitemap Date both follow automatically.
const LAST_UPDATED_ISO = '2026-05-31';

export const LEGAL_LAST_UPDATED = new Date(LAST_UPDATED_ISO);

// Pre-formatted display string for the visible "Last updated"
// line. en-GB long-form (e.g. "31 May 2026") matches the rest of
// the marketing site's locale convention (see app/layout.tsx
// inLanguage / openGraph locale). Computed at module load on the
// static-export build, so it's a frozen string in the emitted HTML.
export const LEGAL_LAST_UPDATED_DISPLAY = LEGAL_LAST_UPDATED.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
