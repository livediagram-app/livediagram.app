# Stand-in addresses (until livediagram.app moves)

livediagram runs on the liveworkspace Cloudflare account (`851be7d244b76a6557bcbe6c4ded80f5`), but the
`livediagram.app` zone is still on the previous account, which keeps the historical service online until it is
moved. So the router and mcp workers have no custom domain yet, and livediagram answers on their `workers.dev`
addresses instead:

| Address while the zone is elsewhere                                      | Stands in for                            |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| `https://livediagram-router.liveworkspace-easing509.workers.dev`         | `livediagram.app`, `www.livediagram.app` |
| `https://livediagram-router-staging.liveworkspace-easing509.workers.dev` | `staging.livediagram.app`                |
| `https://livediagram-mcp.liveworkspace-easing509.workers.dev`            | `mcp.livediagram.app`                    |
| `https://livediagram-mcp-staging.liveworkspace-easing509.workers.dev`    | `mcp-staging.livediagram.app`            |

The router already puts every app under one origin ([Router app](router-app.md)), so a stand-in is the router's own
address: nothing new sits in front of it. liveworkspace is on its own stand-in at the same time
([liveworkspace/docs/gateway.md](../../../../liveworkspace/docs/gateway.md)).

## Where the addresses are written

Everywhere livediagram's origin is written in code and configuration (Worker vars, the hosted profile, the shared
packages' site list and allowlists, liveworkspace's `APP_ORIGIN_LIVEDIAGRAM`, the apps' links and canonical URLs),
it is the stand-in for that host. Docs and specs keep naming livediagram.app. Two places match a host rather than
a URL and list the stand-ins beside the real hosts: the Community service's browser origins
(`packages/community/src/apps.ts`, whose staging origin is not `staging.` + the site's host here) and the Drive
mirror's choice of Google client (`packages/api-schema/src/drive.ts`).

The data starts fresh on this account: documents, people and the pre-move image bytes stay on the previous one
until they are migrated. Google sign-in and Drive work on a stand-in only once its address is a redirect URI of the
Google client for that environment.

## When livediagram.app moves

1. Move the `livediagram.app` zone to this account.
2. Declare the custom domains in the router's and mcp's `wrangler.toml`, as liveplanner's do
   ([Deployment](deployment.md#custom-domain)).
3. Replace each stand-in with the host it stands in for, in the same files (search for
   `livediagram-router` and `livediagram-mcp` with `.workers.dev`), and drop the stand-in hosts from the two host
   lists above.
4. Redeploy livediagram, liveworkspace and every app (their site lists carry the address), and point the Google
   clients' redirect URIs back at livediagram.app.
5. Delete this page.
