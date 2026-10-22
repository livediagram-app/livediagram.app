# Trusted Types

Status: shipped

Every page on livedesign.app enforces Trusted Types, so a string can never reach a DOM injection sink
(`innerHTML`, `DOMParser`, a script's or a worker's URL, `eval`) unless a named policy made it. A DOM-based script
injection then needs a policy's help, and every policy is small, named and listed here.

## The header

- **Every HTML response carries** `Content-Security-Policy: require-trusted-types-for 'script'; trusted-types
livedesign-markup nextjs default`, enforced from the start, never
  report-only.
- **Where it is set**: the editor's worker (`apps/live/src/worker.ts`) beside its other security headers; the four
  static apps (marketing, help, telemetry) in their `public/_headers`. The router adds nothing; it holds no
  logic ([Router app](router-app.md)).
- **Further policy names** (a third party's own policy) join the `trusted-types` list only with a row in
  "Third parties" below.

## Our policies

Both come from one shared module, `@livedesign/ui`'s `trusted-types`, and nothing else of ours creates a policy.

- **`default` is created first**, by an inline script at the top of each layout's `<head>`
  (`trustedTypesBootScript`), before any other script can reach a sink. It is what the browser calls for a sink
  given a plain string by code that has no policy. It allows a script URL on the page's own origin under the app's
  own `<asset prefix>/_next/` (`/_next/` for marketing, `/live/_next/`, `/help/_next/` and so on), one on an origin in
  "Third parties", and a worker from the page's own `blob:` URL; it refuses everything else: HTML, script text, and
  any other URL. A `blob:` URL can only be minted by script already running on the page, and a worker has no DOM.
  For HTML it allows exactly `<script></script>`, the empty script React DOM parses to create a `<script>` element on
  a client render (a script inserted through `innerHTML` never runs); any other HTML string is refused.
- **`livedesign-markup`** turns markup that livedesign's own builders produced into `TrustedHTML`
  (`trustedHtml(markup)`). Its callers are the builders that escape every piece of content they place: the icon,
  sticker and template SVG builders (`@livedesign/icons`, `@livedesign/templates`), the headless tab renderer's
  thumbnails, the JSON-LD block, and the inline boot scripts in each layout. It does not sanitise; the trust is that
  the markup came from one of those builders, which is why nothing else may call it.
- **Outside the browser** (the static prerender, tests without Trusted Types) the helpers pass strings through.

### Server-rendered markup

Because the prerender passes strings through, a **server component** that hands `trustedHtml(...)` to
`dangerouslySetInnerHTML` puts a plain string into the RSC payload. The first load is fine (the markup is already in
the HTML), but a client navigation to that page makes React write the string through `innerHTML`, the `default`
policy refuses it, and the page crashes to a blank screen. The help centre's breadcrumb and category links all did
this through the JSON-LD block. So outside the editor (a client app end to end), a sink lives in one of three places:
a root `app/layout.tsx` (never re-rendered on navigation), a `'use client'` module (the call mints real `TrustedHTML`
in the browser), or an app module that only client modules import. A sink in a shared package must be a client
module itself, since any server page may render it: `JsonLd` is one. `trusted-types-sinks.test.ts` holds every
file to this.

## Third parties

| Code                                                       | Needs                                                                                                                                                              | Allowed by                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| React DOM, rendering a `<script>` in the browser           | `innerHTML = '<script></script>'` on a scratch element (an empty, inert script)                                                                                    | `default`, that exact string alone                                     |
| Next.js and Turbopack's chunk loading                      | Script URLs under `/_next/` (`/live/_next/` in the editor)                                                                                                         | `default`                                                              |
| Next.js's own script helper                                | Its pass-through policy                                                                                                                                            | The `nextjs` policy name                                               |
| Our web workers                                            | Their script URLs under `/_next/`                                                                                                                                  | `default`                                                              |
| Clerk (editor sign-in)                                     | Script URLs on the Clerk frontend API origin                                                                                                                       | `default`, origin from the publishable key                             |
| Clerk's sign-up bot protection                             | Cloudflare Turnstile's script on `https://challenges.cloudflare.com`                                                                                               | `default`, beside Clerk's origin                                       |
| Clerk's session timers                                     | A `Worker` from the page's own `blob:` URL (its fixed timer source)                                                                                                | `default`, for the Worker constructor sink alone                       |
| The Drive mirror (editor, a build with a Google client id) | Google Identity Services (`https://accounts.google.com/gsi/client`) and the API loader with the Picker (`https://apis.google.com/js/api.js`, then the same origin) | `default`, those two origins, only with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |

A worker's own scope is not the page's: its script is served from `/_next/` with no policy header, so the libraries
it runs are outside this boundary.

A third party that needs anything else is a bug to fix with it, never a wider `default`.

**Asked by hand, `default` makes nothing.** The browser always calls the default policy with the sink's name; a call
without one is code asking `trustedTypes.defaultPolicy.createHTML(...)` directly, and the policy throws, so a library
that tries the default policy that way before making its own falls back to its own rather than keep an empty
answer.

**One third party is refused by design.** Cloudflare's JavaScript Detections (bot management) is injected by the edge
into every page: it writes a script into a hidden iframe with `innerHTML`, in the iframe's own realm, where no policy
of ours can reach. Trusted Types refuses it, so each page load logs one error from Cloudflare's snippet
(`/cdn-cgi/challenge-platform/scripts/jsd/`) and Cloudflare gets no JavaScript-detection signal. That trade is
accepted: no bot or firewall rule may depend on that signal, and the error is not counted as a violation of ours:
the client error report (`installClientErrorTracking`) skips a TrustedHTML refusal thrown by an inline script
(`isEdgeSnippetRefusal`), since every script of ours is a file. Before that skip, each help centre page load
reported it as `Uncaught.Help.NonError` or `Uncaught.Help.TypeError`.

## A refusal

- **The browser blocks the sink and throws**, and the page logs `[trusted-types] violation` with the directive and
  the sink, from a `securitypolicyviolation` listener every app installs.
- **A violation is a defect**: the end-to-end suite fails on one ([E2E smoke](../003-system-architecture/e2e-smoke.md)),
  against a stack that sends the editor's header.

## Out of scope

- `script-src` and the rest of a full Content Security Policy; Trusted Types is the one directive set here.
