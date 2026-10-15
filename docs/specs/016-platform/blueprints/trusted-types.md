# Trusted Types blueprint

Derived from [Trusted Types](../trusted-types.md).

## Domain and naming

| Term             | Identifier                               | Meaning                                                                           |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| The header value | `TRUSTED_TYPES_CSP`                      | `require-trusted-types-for 'script'; trusted-types livediagram-markup default`    |
| Markup policy    | `MARKUP_POLICY` (`'livediagram-markup'`) | Makes `TrustedHTML` from livediagram's own builders' markup                       |
| Default policy   | `'default'`                              | The browser's fallback for a plain string at a sink                               |
| Boot script      | `trustedTypesBootScript(origins)`        | Inline, first in each layout's `<head>`: the default policy and the violation log |
| Markup helper    | `trustedHtml(markup)`                    | `TrustedHTML` in a browser with Trusted Types, else the string itself             |
| Allowed origin   | `trustedScriptOrigins(env)`              | Third-party script origins the default policy lets through                        |

## Modules

| File                                                        | Responsibility                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/trusted-types.ts`                          | `TRUSTED_TYPES_CSP`, `MARKUP_POLICY`, `trustedHtml`, `trustedTypesBootScript`, `trustedScriptOrigins`, `isAllowedScriptUrl` |
| `apps/*/app/layout.tsx` (all five)                          | The boot script first in `<head>`; every inline boot script's `__html` through `trustedHtml`                                |
| `apps/live/src/worker.ts`                                   | `Content-Security-Policy: TRUSTED_TYPES_CSP` beside its other security headers                                              |
| `apps/{marketing,help,community,telemetry}/public/_headers` | The same header on `/*`                                                                                                     |
| `scripts/e2e-stack.mjs`                                     | Sends the editor's header on HTML, as the worker does                                                                       |
| Every `dangerouslySetInnerHTML` site (33)                   | `__html: trustedHtml(markup)`                                                                                               |

## Behaviour and state

### The default policy (boot script)

```js
// Plain ES5, inlined; `ORIGINS` is the JSON array trustedScriptOrigins(env) gives at build.
if (window.trustedTypes && trustedTypes.createPolicy) {
  trustedTypes.createPolicy('default', {
    createScriptURL: function (url) {
      var u = new URL(url, location.href);
      var own = u.origin === location.origin && /^\/(live\/)?_next\//.test(u.pathname);
      if (own || ORIGINS.indexOf(u.origin) >= 0) return url;
      console.error('[trusted-types] script-url-refused ' + u.origin + u.pathname);
      return null; // the browser blocks the sink
    },
  });
}
addEventListener('securitypolicyviolation', function (e) {
  if (
    e.violatedDirective.indexOf('trusted-types') === 0 ||
    e.violatedDirective.indexOf('require-trusted-types') === 0
  )
    console.error('[trusted-types] violation ' + e.violatedDirective + ' ' + (e.sample || ''));
});
```

- No `createHTML` and no `createScript`: an HTML or script string from code without a policy is refused.
- `isAllowedScriptUrl(url, pageOrigin, origins)` is the same rule as a pure function, for tests; the boot script is
  built from it (`.toString()` of a self-contained function), so the two cannot drift.

### `trustedHtml`

1. In a browser with `trustedTypes`, the first call creates `MARKUP_POLICY` with `createHTML: (s) => s` and keeps it.
2. It returns `policy.createHTML(markup)`.
3. Without `trustedTypes` (the prerender, jsdom, an older browser) it returns `markup`.

### Third-party origins

`trustedScriptOrigins(env)` returns the Clerk frontend API origin decoded from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
(`pk_<env>_<base64 of "<host>$">`) when it is set, else `[]`. An app without Clerk passes no env.

## Interfaces and contracts

```ts
export const TRUSTED_TYPES_CSP: string;
export const MARKUP_POLICY: 'livediagram-markup';
export function trustedHtml(markup: string): TrustedHTML | string;
export function isAllowedScriptUrl(
  url: string,
  pageOrigin: string,
  origins: readonly string[],
): boolean;
export function trustedScriptOrigins(env: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string }): string[];
export function trustedTypesBootScript(origins: readonly string[]): string;
```

## Errors and edge cases

| Case                                       | Handling                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| A sink given a plain string by our code    | Blocked, logged; the sinks test fails it before it ships             |
| A third-party script URL not allowed       | Blocked, `[trusted-types] script-url-refused`; fixed with that party |
| A browser without Trusted Types            | The header is ignored; `trustedHtml` passes strings                  |
| The policy created twice (a second bundle) | The second `createPolicy` throws; `trustedHtml` keeps one per page   |
| A malformed publishable key                | No Clerk origin; Clerk's script is refused and logged                |

## Security and trust

- Trust boundary: `trustedHtml` is the only path to `TrustedHTML`, and its callers are the builders the spec names,
  each of which escapes content it places (`xmlEscape`). The sinks test lists every call site.
- The default policy allows script URLs only: own `/_next/` assets and named origins.
- `trusted-types` names the two policies, so no other code can create one.

## Performance and limits

`createHTML` is an identity: one call per markup render, no parsing.

## Observability

| Fingerprint                          | Level | When                                    |
| ------------------------------------ | ----- | --------------------------------------- |
| `[trusted-types] violation`          | error | Any Trusted Types violation on the page |
| `[trusted-types] script-url-refused` | error | The default policy refuses a URL        |

## Testing

| Rule                                         | Test                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| The URL rule                                 | `packages/ui/src/trusted-types.test.ts`: `isAllowedScriptUrl` cases                 |
| Clerk origin from the key                    | `trusted-types.test.ts`: `trustedScriptOrigins`                                     |
| `trustedHtml` with and without Trusted Types | `trusted-types.test.ts`                                                             |
| Every sink uses `trustedHtml`                | `packages/ui/src/trusted-types-sinks.test.ts` (scans every app and package)         |
| Every app sends the header                   | `trusted-types-sinks.test.ts` reads each `_headers`; `apps/live/src/worker.test.ts` |
| Every layout boots the policy first          | `trusted-types-sinks.test.ts` reads each `app/layout.tsx`                           |
| No violation in the running apps             | E2E smoke (`pageErrors`), with the header from `e2e-stack.mjs`                      |

## Constants and configuration

| Constant            | Value                                                                          | Provenance | Safe range |
| ------------------- | ------------------------------------------------------------------------------ | ---------- | ---------- |
| `TRUSTED_TYPES_CSP` | `require-trusted-types-for 'script'; trusted-types livediagram-markup default` | Spec       | Fixed      |

## Defaults ledger

D9 and D10 in [DEFAULTS.md](DEFAULTS.md).
