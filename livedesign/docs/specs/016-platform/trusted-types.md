# Trusted Types

Status: shipped

Every page on livedesign.app enforces Trusted Types, so a string can never reach a DOM injection sink
(`innerHTML`, `DOMParser`, a script's or a worker's URL, `eval`) unless a named policy made it. A DOM-based script
injection then needs a policy's help, and every policy is small, named and listed here.

## The header

- **Every HTML response carries** `Content-Security-Policy: require-trusted-types-for 'script'; trusted-types
liveworkspace-markup nextjs default`, enforced from the start, never
  report-only.
- **Where it is set**: the editor's worker (`apps/live/src/worker.ts`) beside its other security headers; the two
  static apps (marketing, help) in their `public/_headers`. The router adds nothing; it holds no
  logic ([Router app](router-app.md)).
- **Further policy names** (a third party's own policy) join the `trusted-types` list only with a row in
  "Third parties" below.

## Our policies

Both come from `@liveworkspace/trusted-types`, built once for every app and for liveworkspace.app, and
re-exported with this app's header by `@livedesign/ui`'s `trusted-types`. Nothing else of ours creates a policy. Every
app creates the same policies under the same names, so a page that renders another app's UI (liveworkspace.app's
telemetry dashboard, the Explorer each app's router serves from liveworkspace.app) never needs another app's names
in its header.

- **`default` is created first**, by an inline script at the top of each layout's `<head>`
  (`trustedTypesBootScript`), before any other script can reach a sink. It is what the browser calls for a sink
  given a plain string by code that has no policy. It allows a script URL on the page's own origin under the app's
  own `<asset prefix>/_next/` (`/_next/` for marketing, `/live/_next/`, `/help/_next/` and so on), one on an origin in
  "Third parties", a worker from the page's own `blob:` URL, and the push-only service worker at exactly
  `/push-worker.js` on the page's own origin, for `navigator.serviceWorker.register` alone
  (liveworkspace/docs/specs/003-accounts/push.md); it refuses everything else: HTML, script text, and
  any other URL. A `blob:` URL can only be minted by script already running on the page, and a worker has no DOM.
  For HTML it allows exactly `<script></script>`, the empty script React DOM parses to create a `<script>` element on
  a client render (a script inserted through `innerHTML` never runs); any other HTML string is refused.
- **`liveworkspace-markup`** turns markup that livedesign's own builders produced into `TrustedHTML`
  (`trustedHtml(markup)`, reached only through [One path for markup](#one-path-for-markup) below). Its callers are
  the builders that escape every piece of content they place: the icon,
  sticker and template SVG builders (`@liveworkspace/icons`, `@livedesign/templates`), the headless tab renderer's
  thumbnails, the JSON-LD block, and the inline boot scripts in each layout, and the sanitiser's output. The policy
  itself does not sanitise: the trust is that the markup came from one of those builders, so the escape hatch
  (`trustedConstant`, `builtMarkup`) may be used only in a layout and the files listed as builder markup. Markup that
  carries people's content goes through the sanitiser instead ([The sanitiser](#the-sanitiser)).
- **Outside the browser** (the static prerender, tests without Trusted Types) the helpers pass strings through.

### Server-rendered markup

Because the prerender passes strings through, a **server component** that hands `htmlProps(...)` to an
element puts a plain string into the RSC payload. The first load is fine (the markup is already in
the HTML), but a client navigation to that page makes React write the string through `innerHTML`, the `default`
policy refuses it, and the page crashes to a blank screen. The help centre's breadcrumb and category links all did
this through the JSON-LD block. A `<Suspense>` boundary the static export leaves to the browser does the same on the
first load: liveworkspace.app's Explorer rendered its silent sign-in script inside one and blanked every `/explorer`
page, on every app's address. So outside the editor (a client app end to end), a sink lives in one of three places:
a root `app/layout.tsx` (never re-rendered on navigation), a `'use client'` module (the call mints real `TrustedHTML`
in the browser), or an app module that only client modules import. A sink in a shared package must be a client
module itself, since any server page may render it: `JsonLd` is one. `trusted-types-sinks.test.ts` holds every
file to this.

### One path for markup

Every raw HTML sink in our code goes through one small module, `@liveworkspace/trusted-types`'s `html.ts`, and
nothing else of ours writes one:

- **A React element** takes markup as `{...htmlProps(markup)}`; no other file spells `dangerouslySetInnerHTML`.
- **A DOM element** takes it through `setHtml(element, markup)`, and an iframe's document through
  `setSrcdoc(frame, markup)`; no other file assigns `innerHTML`, `outerHTML` or `srcdoc`, or calls
  `insertAdjacentHTML`, `createContextualFragment`, `setHTMLUnsafe` or `document.write`.
- **The markup is a `SafeHtml`**, a branded string, so the type system shows where each one was vetted. A plain
  string does not type-check. It is made one of four ways, and each is a line to review:
  - `trustedConstant(source)`: markup or an inline script written in our own source and fixed at build time (the
    boot scripts in each layout, the pre-hydration scripts, an authored SVG string), its only inputs our own
    constants.
  - `builtMarkup(markup)`: what one of our builders produced from our own typed data, a builder that escapes every
    piece of content it places (the icon, sticker and template SVG builders, a look's sample preview, the face-finish
    ink).
  - `jsonScript(data)`: a JSON payload for an inline `<script>` (the JSON-LD block), with every `<` escaped so
    nothing in it can close the script.
  - `sanitizedHtml(markup, profile)`: markup that carries people's content, a design's drawing above all, run through
    [the sanitiser](#the-sanitiser). That content reaches a sink only this way.
- **Markup that needs no injection is JSX.** A fixed SVG picture is written as elements, not as a string.
- **The escape hatch is reviewed.** `trustedConstant` and `builtMarkup` vet nothing, so the sinks test lets them be
  used only in a layout and the files each product lists as builder markup; a new sink of people's content has to
  use `sanitizedHtml`. A file or paste a person brings is read through `parseInert`, and only its text and
  attributes are used.
- **CI refuses a new raw sink.** The raw HTML guard (`raw-html-guard.mjs` in the CI scripts folder, run by the Checks
  job and the pre-push hook; [docs/ci.md](../../../../docs/ci.md) "One path for markup") scans every tracked non-test
  source file in the repository and fails on any of those sinks outside `html.ts`.

## The sanitiser

The policies prove markup went through one of ours; they do not make it safe. Markup that carries people's content
(their text, links and pictures, arriving from imports, pastes, the server and other people over the room) is
sanitised before any sink shows it.

- **`sanitizedHtml(markup, profile)`** (`@liveworkspace/trusted-types/sanitize`) runs it through DOMPurify, in an
  instance of our own with our rules, and answers a `SafeHtml` that the sinks above mint through `liveworkspace-markup` like any
  other, so no header names another policy. DOMPurify parses through the same policy and creates none of its own.
- **Every sink of a document's drawing goes through it**: the export preview, the split view's other pane, a tab window's drawing, a component's instances and its palette tiles, and the page layout preview (it carries the page's own elements).
- **Profiles**: `svg`, a whole drawing set into an HTML element; `svg-content`, an `<svg>`'s or `<g>`'s children,
  sanitised inside an `<svg>` so they parse as SVG; `document`, a whole page for an iframe's `srcdoc`.
- **What it removes**: `<script>`, every event handler, `javascript:` and every other scheme but http(s), mailto, tel
  and the like, `<foreignObject>`, `<use>`, `<animate>` and `<set>`, frames and embeds, and any `href` that would load
  from outside the drawing other than a link's or a picture's; a `blob:` URL is kept on a picture alone.
- **What it keeps**: everything our renderers draw, unchanged: gradients, clips, masks, markers, patterns, filters,
  `<style>` (the export's webfont import), text, links (http(s) and `#`), pictures (`data:`, `blob:`, http(s) and
  same-origin paths), `class`, `style`, `role`, `aria-*` and `data-*`. Every template's drawing parses the same
  before and after.
- **What stays on the escape hatch** (`trustedConstant`, `builtMarkup`, unsanitised): each layout's inline boot
  scripts and our other build-time scripts, and markup that is static or that
  our builders make from typed data alone: the catalogue's icons and stickers, a look's sample preview, device
  frames, and the face-finish ink (`useFaceFinishPass`), drawn per element from its geometry and the colours
  `dropUnsafeColours` already checked on the way in. That ink is a hot path (every element, every frame of a
  redraw), so it stays off the sanitiser.
- **Cost**: each result is cached by its markup (least recently used out first, at most 256 results and 4 million
  characters held), so a re-render that hands back the same drawing costs a lookup. DOMPurify lives in a module of
  its own, so it reaches only the chunks that render such markup, never a page that has none.
- **Outside the browser** (the prerender, a test without a DOM) it answers an empty string, never the markup
  unsanitised.

## Third parties

| Code                                             | Needs                                                                             | Allowed by                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| React DOM, rendering a `<script>` in the browser | `innerHTML = '<script></script>'` on a scratch element (an empty, inert script)   | `default`, that exact string alone               |
| Next.js and Turbopack's chunk loading            | Script URLs under `/_next/` (`/live/_next/` in the editor)                        | `default`                                        |
| Next.js's own script helper                      | Its pass-through policy                                                           | The `nextjs` policy name                         |
| Our web workers                                  | Their script URLs under `/_next/`                                                 | `default`                                        |
| Nothing today (Clerk's session timers did)       | A `Worker` from the page's own `blob:` URL; the rule is kept                      | `default`, for the Worker constructor sink alone |
| The push-only service worker                     | `/push-worker.js` on the page's own origin, to `navigator.serviceWorker.register` | `default`, for that sink and path alone          |

No ProseMirror: the article editor stayed with livedocuments, so the header names no `ProseMirrorClipboard` policy
(`packages/ui/src/trusted-types.test.ts` fails if a livedesign package brings ProseMirror in).

Sign-in loads no third-party script: it is a full-page hand-off to the liveworkspace accounts site, so no third-party
origin is allowed. When the editor signed in through Clerk, its script origin and Cloudflare Turnstile's (for sign-up
bot protection) were allowed here.

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
