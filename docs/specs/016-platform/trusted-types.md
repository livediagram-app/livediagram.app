# Trusted Types

Status: specified

Every page on livediagram.app enforces Trusted Types, so a string can never reach a DOM injection sink
(`innerHTML`, a script's `src` or text, `eval`) unless a named policy made it. A DOM-based script injection then needs
a policy's help, and every policy is small, named and listed here.

## The header

- **Every HTML response carries** `Content-Security-Policy: require-trusted-types-for 'script'; trusted-types
livediagram-markup default`, enforced from the start, never report-only.
- **Where it is set**: the editor's worker (`apps/live/src/worker.ts`) beside its other security headers; the four
  static apps (marketing, help, community, telemetry) in their `public/_headers`. The router adds nothing; it holds no
  logic ([Router app](router-app.md)).
- **Further policy names** (a third party's own policy) join the `trusted-types` list only with a row in
  "Third parties" below.

## The policies

Both come from one shared module, `@livediagram/ui`'s `trusted-types`, and nothing else creates a policy.

- **`default` is created first**, by an inline script at the top of each layout's `<head>`
  (`TRUSTED_TYPES_BOOT_SCRIPT`), before any other script can reach a sink.
- **`livediagram-markup` is created on first use**, once per page, by `trustedHtml`.

- **`livediagram-markup`** turns markup that livediagram's own builders produced into `TrustedHTML`
  (`trustedHtml(markup)`). Its callers are the builders that escape every piece of content they place: the icon,
  sticker and template SVG builders (`@livediagram/icons`, `@livediagram/templates`), the headless tab renderer's
  thumbnails, the JSON-LD block, and the inline boot scripts in each layout. It does not sanitise; the trust is that the
  markup came from one of those builders, which is why nothing else may call it.
- **`default`** is what the browser calls for a sink given a plain string by code that has no policy (a third party).
  It allows a script URL on the page's own origin under `/_next/` or `/live/_next/`, or on an origin in "Third parties",
  and refuses everything else: HTML, script text, and any other URL.
- **Outside the browser** (the static prerender, tests without Trusted Types) `trustedHtml` returns the string itself.

## Third parties

| Origin or code                        | Needs                                                      | Allowed by                                   |
| ------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| Next.js and Turbopack's chunk loading | Script URLs under `/_next/` (`/live/_next/` in the editor) | `default`                                    |
| Clerk (editor, community sign-in)     | Script URLs on the Clerk frontend API origin               | `default`, origin from `NEXT_PUBLIC_CLERK_*` |

A third party that needs anything else is a bug to fix with it, never a wider `default`.

## A refusal

- **The browser blocks the sink and throws**, and the page logs `[trusted-types] violation` with the directive and
  the sink, from a `securitypolicyviolation` listener every app installs.
- **A violation is a defect**: the end-to-end suite fails on one ([E2E smoke](../003-system-architecture/e2e-smoke.md)).

## Out of scope

- `script-src` and the rest of a full Content Security Policy; Trusted Types is the one directive set here.
