# @liveworkspace/community-site

The Community on every app's address: the step each app's router runs for `/community`. The Community's pages (the
gallery and a post's page) are liveworkspace.app's, built once in `liveworkspace/apps/site` and served under each
app's own address by its router, the way the Explorer is (`@liveworkspace/sites/workspace-proxy`). What every app's
Community is, and how the pages are scoped to an app or to All Apps, is in
[liveworkspace/docs/specs/007-community](../../liveworkspace/docs/specs/007-community/community.md) ("One page for
every app", "Search engines").

## Binding an app's router

```ts
import { routeCommunity } from '@liveworkspace/community-site/router';

const community = routeCommunity(request, {
  site: { app: 'livediagram.app', siteUrl: SITE_URL, product: 'livediagram', nouns: 'canvases' },
  communityUrl: env.COMMUNITY_URL,
  forward: (req) => routeToWorkspace(req, { app: 'livediagram', origin: env.WORKSPACE_ORIGIN }),
});
if (community) return community;
```

It runs before the router's other routes. It answers the sitemap itself, makes the gallery's head the app's own
(title, description, canonical) and fills a post's head from the Community service, and hands every other Community
path to `forward` as it is.

## Entries

| Entry      | What                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| `./router` | `routeCommunity`, `isCommunityPath`, `CommunityRouteOptions`, `CommunityRouteSite` |
