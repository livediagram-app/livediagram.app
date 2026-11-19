import { HELP_SCOPES, helpUrl } from '@liveworkspace/help-registry';
import { allArticles, categoriesFor, HELP_REDIRECTS } from '@liveworkspace/help-registry/catalogue';
import { articlePath } from '@liveworkspace/help-registry/telemetry';

// The help Worker's map (liveworkspace/apps/help src/help-scope.ts HelpManifest), from the one catalogue: every article
// path and category landing with the apps it applies to, the redirect map, and each scope's origin. Emitted by every
// build at /help/scope-manifest.json; scripts/build-scopes.mjs keeps the `all` build's as dist/manifest.json and drops
// the rest. The same for every scope, since it reads the whole catalogue.
export const dynamic = 'force-static';

export function GET() {
  const origins = Object.fromEntries(HELP_SCOPES.map((s) => [s, helpUrl(s).replace(/\/help$/, '')]));
  return Response.json({
    articles: Object.fromEntries(allArticles.map((a) => [articlePath(a), [...a.apps]])),
    // A landing with no articles (Contact) is every app's, so it is left out and served in every scope.
    categories: Object.fromEntries(
      categoriesFor('all')
        .filter((c) => (c.apps?.length ?? 0) > 0)
        .map((c) => [c.slug, [...c.apps!]]),
    ),
    redirects: HELP_REDIRECTS.map((r) => ({ ...r, ...(r.apps && { apps: [...r.apps] }) })),
    origins,
  });
}
