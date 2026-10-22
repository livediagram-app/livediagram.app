# Trusted Types blueprint

Derived from [Trusted Types](../trusted-types.md).

## Domain and naming

| Term             | Identifier                                     | Meaning                                                                                                    |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The header value | `TRUSTED_TYPES_CSP`                            | `require-trusted-types-for 'script'; trusted-types liveplanner-markup nextjs ProseMirrorClipboard default` |
| Markup policy    | `MARKUP_POLICY` (`'liveplanner-markup'`)       | Makes `TrustedHTML` from liveplanner's own builders' markup                                                |
| Default policy   | `'default'`                                    | The browser's fallback for a plain string at a sink                                                        |
| Boot script      | `trustedTypesBootScript(assetPrefix, origins)` | Inline, first in each layout's `<head>`: the default policy and the violation log                          |
| Asset prefix     | `''`, `/live`, `/help`, `/telemetry`           | Where an app's own build is served from (`assetPrefix` or `basePath`)                                      |
| Markup helper    | `trustedHtml(markup)`                          | `TrustedHTML` in a browser with Trusted Types, else the string itself                                      |
| Allowed origin   | `origins` (default `[]`)                       | Third-party script origins the default policy lets through; none since sign-in left the page               |

## Modules

| File                                                         | Responsibility                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/trusted-types-csp.ts`                       | `TRUSTED_TYPES_CSP`, `MARKUP_POLICY`; import-free, so `scripts/e2e-stack.mjs` runs it as is                                        |
| `packages/ui/src/trusted-types.ts`                           | `trustedHtml`, `isAllowedScriptUrl`, `trustedTypesBootScript`; exported from `@liveplanner/ui` and `@liveplanner/ui/trusted-types` |
| `apps/*/app/layout.tsx` (all four)                           | `TRUSTED_TYPES_BOOT` (the boot script for the app's prefix), first in `<head>`; help and telemetry gain a `<head>` for it          |
| `apps/live/src/worker.ts`                                    | `Content-Security-Policy: TRUSTED_TYPES_CSP` among its security headers                                                            |
| `apps/{marketing,help,telemetry}/public/_headers`            | The same header on `/*`                                                                                                            |
| `scripts/e2e-stack.mjs`                                      | Sends the header on every HTML response, as production does                                                                        |
| Every `dangerouslySetInnerHTML` site                         | `__html: trustedHtml(markup)`                                                                                                      |
| Every `innerHTML`, `outerHTML` or `insertAdjacentHTML` write | `el.innerHTML = trustedHtml(markup) as string` (`useFaceFinishPass.ts`, the Marker and Sketch face ink)                            |

## Behaviour and state

### The default policy (boot script)

The script inlines `isAllowedScriptUrl`'s own source (its `toString()`), so the rule the tests prove is the rule the
page runs, minified or not:

```js
(function () {
  var PREFIX = '/help', ORIGINS = [];
  var allowed = /* isAllowedScriptUrl's source */;
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    window.trustedTypes.createPolicy('default', {
      createScriptURL: function (url, type, sink) {
        if (allowed(String(url), location.origin, PREFIX, ORIGINS, sink)) return String(url);
        console.error('[trusted-types] script-url-refused ' + url);
        return null; // the browser blocks the sink
      },
      // React DOM's scratch <script> (inert); written <\/script> so the HTML parser never ends this script early.
      createHTML: function (html, type, sink) {
        if (html === '<script><\/script>') return html;
        // Called by hand (no sink): make nothing, so ProseMirror falls back to its own policy.
        if (sink === undefined) throw new TypeError('[trusted-types] the default policy makes no HTML on request');
        console.error('[trusted-types] html-refused ' + html);
        return null;
      },
    });
  }
  addEventListener('securitypolicyviolation', function (e) {
    if (String(e.violatedDirective).indexOf('trusted-types') >= 0)
      console.error('[trusted-types] violation ' + e.violatedDirective + ' ' + (e.sample || ''));
  });
})();
```

`isAllowedScriptUrl(url, pageOrigin, assetPrefix, origins, sink?)`:

1. Parse against the page; unparseable is refused.
2. `blob:` is allowed only when `sink === 'Worker constructor'` and its origin is the page's. Clerk's session timers
   needed it; since sign-in moved to the accounts Worker nothing on the page does, but the rule stays.
3. Anything but `http:` / `https:` is refused.
4. The page's origin with a path starting `<assetPrefix>/_next/` is allowed.
5. Otherwise allowed only when its origin is in `origins`.

No `createScript`, and `createHTML` passes one string alone: an HTML or script string from code without a policy is
refused. Called directly (`trustedTypes.defaultPolicy.createHTML(html)`, no sink argument), `createHTML` throws and
logs nothing: it is not a violation, and a library that probes the default policy first (ProseMirror) then makes its
own named policy. The boot script contains no `</script` anywhere (a test holds it), since it is written into one.

### `trustedHtml`

1. In a browser with `trustedTypes`, the first call creates the policy (`createHTML: (s) => s`) and keeps it.
2. It returns the policy's `TrustedHTML`.
3. Without `trustedTypes` (the prerender, jsdom, a worker scope without enforcement) the string passes through.

### Third-party origins

None. Every layout calls `trustedTypesBootScript(prefix)` with no origins, so `ORIGINS` is `[]`. Sign-in used to load
Clerk's script (from the origin in its publishable key) and Cloudflare Turnstile for its sign-up CAPTCHA; it now
happens on the accounts site (liveworkspace.app), a full-page redirect, so no sign-in script runs on our pages.
`origins` stays as a parameter for a third party that one day needs it.

## Interfaces and contracts

```ts
export const TRUSTED_TYPES_CSP: string;
export const MARKUP_POLICY: 'liveplanner-markup';
export function trustedHtml(markup: string): TrustedHTML | string;
export function isAllowedScriptUrl(
  url: string,
  pageOrigin: string,
  assetPrefix: string,
  origins: readonly string[],
  sink?: string,
): boolean;
export function trustedTypesBootScript(assetPrefix: string, origins?: readonly string[]): string;
```

## Errors and edge cases

| Case                                         | Handling                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A sink given a plain string by our code      | Blocked and logged; the sinks test fails it before it ships                                  |
| A third-party script URL not allowed         | Blocked, `[trusted-types] script-url-refused`; fixed with that party                         |
| Another app's build (`/live/_next/` on help) | Refused: each app allows its own prefix alone                                                |
| A browser without Trusted Types              | The header is ignored; the helpers pass strings                                              |
| A prefix or origin that is not one           | `trustedTypesBootScript` throws, so the build fails; what it embeds is JSON with `<` escaped |

## Security and trust

- `trustedHtml` is the only path to `TrustedHTML` for markup, and its callers are the escaping builders; the sinks
  test lists every call site. No file is parsed with `DOMParser`, which no policy lets through.
- The default policy allows script URLs only: this app's own `/_next/`, named origins, and same-origin `blob:` for a
  worker. `trusted-types` names every policy, so no other code can create one.

## Performance and limits

`createHTML` is an identity: one call per markup render, no parsing.

## Observability

| Fingerprint                          | Level | When                                      |
| ------------------------------------ | ----- | ----------------------------------------- |
| `[trusted-types] violation`          | error | Any Trusted Types violation on the page   |
| `[trusted-types] script-url-refused` | error | The default policy refuses a URL          |
| `[trusted-types] html-refused`       | error | The default policy refuses an HTML string |

## Testing

| Rule                                                 | Test                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| The URL rule, prefixes and the blob worker           | `packages/ui/src/trusted-types.test.ts`: `isAllowedScriptUrl` cases        |
| `trustedHtml`                                        | `trusted-types.test.ts`                                                    |
| The boot script runs the rule and logs               | `trusted-types.test.ts`: `trustedTypesBootScript`                          |
| Every sink uses a policy, direct DOM writes included | `packages/ui/src/trusted-types-sinks.test.ts` (every app and package)      |
| Every layout boots first, with its prefix            | `trusted-types-sinks.test.ts` (prefix read from each `next.config.ts`)     |
| Every app sends the header                           | `trusted-types-sinks.test.ts` (`_headers`); `apps/live/src/worker.test.ts` |
| No violation in the running editor                   | The E2E suite against `scripts/e2e-stack.mjs`, which sends the header      |

## Constants and configuration

| Constant            | Value                   | Provenance | Safe range |
| ------------------- | ----------------------- | ---------- | ---------- |
| `TRUSTED_TYPES_CSP` | as in Domain and naming | Spec       | Fixed      |

## Defaults ledger

D9 and D10 in [DEFAULTS.md](DEFAULTS.md).
