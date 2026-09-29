# Profile picture: blueprint

Derived from [Profile picture](../profile-picture.md). Defaults applied where the spec is silent
are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

| File                                                                                        | Role                                                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/live/lib/account-avatar.ts`                                                           | Pure: `resolveProfilePicture`, `sizedPictureUrl`, `accountInitial`, `pictureHost`       |
| `apps/live/components/providers/deferred-auth.tsx`                                          | `DeferredAuthUser` gains `pictureUrl`                                                   |
| `apps/live/components/providers/ClerkBridge.tsx`                                            | Publishes `pictureUrl: resolveProfilePicture(user)`                                     |
| `apps/live/components/primitives/AccountAvatar.tsx`                                         | The disc: initial always, picture overlaid once loaded, initial again on failure        |
| `apps/live/components/chrome/AuthControls.tsx`                                              | Account menu trigger draws `AccountAvatar` at `HEADER_ICON_SLOT_PX`                     |
| `apps/live/components/dialogs/settings/SettingsAccountRows.tsx`                             | Identity card draws `AccountAvatar` at `IDENTITY_AVATAR_PX`                             |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`                               | Identity row copy and keywords name the picture                                         |
| `apps/help/app/account-and-data/signing-in/page.mdx`, `packages/help-registry/src/index.ts` | "Your profile picture" section; article description and keywords                        |
| `apps/live/e2e/clerk-stub/clerk-stub.ts`                                                    | Installs a fake `window.Clerk` with a chosen user before the page loads                 |
| `apps/live/e2e/clerk-stub/profile-picture.spec.ts`                                          | The end-to-end states against a Clerk-enabled build                                     |
| `apps/live/scripts/build-clerk-stub.mjs`                                                    | Builds the Clerk-enabled export the stub runs against (`.next/out-clerk-stub/`)         |
| `apps/live/playwright.config.ts`, `scripts/e2e-stack.mjs`                                   | The `clerk-stub` project (`E2E_CLERK_STUB=1`), ports 3015 / 8788 / 3016, `E2E_LIVE_OUT` |
| `.github/workflows/e2e.yml`                                                                 | Builds the stub export and runs the signed-in specs after the smoke suite               |

## Domain and naming

| Term                | Identifier                                            | Meaning                                                           |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Account avatar      | `AccountAvatar`                                       | The disc that draws the signed-in user to themselves              |
| Profile picture URL | `pictureUrl` (`string \| null`)                       | The resolved, sized image URL, or null for none                   |
| Initial             | `accountInitial(user)`                                | First letter of first name, else username, else `?`, upper-cased  |
| Picture source      | `ClerkPictureSource`                                  | The structural slice of Clerk's `UserResource` the resolver reads |
| Google account      | `externalAccounts[i]`, `provider === 'google'`        | The OAuth account linked through Google sign-in                   |
| Avatar state        | `AvatarState` = `'initial' \| 'loading' \| 'picture'` | What the disc shows; exposed as `data-avatar-state`               |

Banned: "photo", "profile image" and "avatar URL" as identifiers; the code says `picture`.

## Behaviour and state

`resolveProfilePicture(user)`:

1. `google = user.externalAccounts.find(a => a.provider === 'google' && a.imageUrl !== '')`;
   if found and `sizedPictureUrl(google.imageUrl)` is non-null, return it.
2. Else if `user.hasImage`, return `sizedPictureUrl(user.imageUrl)` (may be null).
3. Else return null.

`sizedPictureUrl(url)`: parse with `new URL(url)`; a throw or a protocol other than `https:`
returns null. When `hostname === CLERK_IMAGE_HOST`, set `width` and `height` to
`PROFILE_PICTURE_PX` and `fit` to `crop` on `searchParams` (overwriting any existing values,
keeping any other parameter) and return `toString()`. Any other host returns the URL unchanged.

`AccountAvatar` state machine, keyed by `pictureUrl`:

| From      | Event                 | To                                 |
| --------- | --------------------- | ---------------------------------- |
| (mount)   | `pictureUrl === null` | `initial`                          |
| (mount)   | `pictureUrl !== null` | `loading`                          |
| `loading` | `load`                | `picture`                          |
| `loading` | `error`               | `initial` (logs, D3)               |
| any       | `pictureUrl` changes  | `loading` (or `initial` when null) |

Held as two pieces of state, `loadedUrl` and `failedUrl`, each compared with the current
`pictureUrl`, so a new URL starts fresh with no effect to reset them (D4). Invariant: in every
state the outer box is `size` by `size`, and the initial is in the DOM.

## Interfaces and contracts

```ts
// apps/live/lib/account-avatar.ts
export const PROFILE_PICTURE_PX = 96;
export const CLERK_IMAGE_HOST = 'img.clerk.com';
export type ClerkPictureSource = {
  hasImage: boolean;
  imageUrl: string;
  externalAccounts: readonly { provider: string; imageUrl: string }[];
};
export function resolveProfilePicture(user: ClerkPictureSource): string | null;
export function sizedPictureUrl(url: string): string | null;
export function accountInitial(
  user: { firstName: string | null; username: string | null } | null,
): string;
export function pictureHost(url: string): string; // hostname, or 'invalid'

// apps/live/components/primitives/AccountAvatar.tsx
export function AccountAvatar(props: {
  initial: string;
  pictureUrl: string | null;
  size: number;
  className: string; // the disc's colour + type classes, as the initials disc had
}): JSX.Element;
```

`DeferredAuthUser.pictureUrl: string | null` is the only new field in the auth context. Clerk's
`UserResource` satisfies `ClerkPictureSource` structurally, so the bridge passes `user` as is.

## Data and persistence

`pictureUrl` is derived, never stored: it lives in React state for the page's life and is
recomputed from each Clerk emission. Nothing is written to D1, R2, `localStorage` or IndexedDB;
no migration.

## Errors and edge cases

| Case                                                | Handling                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `imageUrl` empty, malformed or `http:`              | `sizedPictureUrl` returns null; next source, else initial                                                             |
| Google account present, image empty                 | Skipped; falls to `hasImage`                                                                                          |
| Two Google accounts linked                          | The first in Clerk's order wins (D1)                                                                                  |
| `hasImage` false (Clerk default avatar)             | Never shown; initial                                                                                                  |
| Image 404 / network error / blocked by a future CSP | `error` fires: initial, one log line                                                                                  |
| Image cached and complete before React attaches     | Cannot happen: the picture renders only on the client, after auth settles, so `onLoad` is attached before `src` loads |
| Transparent PNG                                     | The initial is `invisible` once the picture shows, so it never bleeds through (D5)                                    |
| User signs out                                      | `user` is null; `AuthControls` shows "Sign in"; no avatar                                                             |
| Clerk disabled                                      | `ClerkBridge` never loads; `pictureUrl` never exists                                                                  |

## Security and trust

The URL crosses one trust boundary, Clerk's authenticated session to the page, the same one the
name and email already cross. It is never read from the api, the realtime room or a URL
parameter. `https:` only (`sizedPictureUrl`). `referrerPolicy="no-referrer"` on the `img`. No
`crossOrigin` attribute, so no credentials and no CORS dependency. No CSP exists today; the spec
records the `img-src https://img.clerk.com` requirement for when one lands.

## Performance and limits

One image per page: both surfaces request the identical URL, so the second is a memory-cache
hit. A 96px square JPEG or WebP from Clerk's CDN is a few kilobytes. `decoding="async"`; no
`loading="lazy"` (both surfaces are on screen when mounted). No re-render beyond the one state
flip on load.

## Presentation and UX

- Outer box: `relative inline-flex shrink-0`, `width` and `height` = `size`, `rounded-full`,
  `overflow-hidden`.
- Beneath: `GlyphDisc` at `size` with the caller's `className` and the initial, exactly the
  initials avatar that shipped before; its text gets `invisible` in state `picture`.
- Over it: `img` `absolute inset-0 h-full w-full rounded-full object-cover`, `width` and
  `height` attributes = `size`, `alt=""`, `draggable={false}`; `opacity-0` until state
  `picture`, then `opacity-100` with no transition (D2).
- Sizes: header trigger `HEADER_ICON_SLOT_PX` (20); identity card `IDENTITY_AVATAR_PX` (44).
- Copy: the identity row's description reads "Your name, email and picture come from your
  account and are changed there, not here." and its search keywords gain `picture photo google`
  (`settings-catalogue.ts`).

## Accessibility

The outer box is `aria-hidden="true"`; `alt=""`. The trigger keeps `aria-label="Account menu"`
and its visible first name; the card keeps the printed full name. The disc's brand colours are
unchanged, so contrast is as before. Nothing animates, so reduced motion needs nothing.

## Web Experience

CLS 0: the box is fixed before, during and after load (asserted by e2e bounding boxes). LCP:
the picture is at most 44px and never the largest paint. INP: no handlers on the image.

## Observability

- `console.warn('[profile-picture] load failed', { host })` on `error`, with `pictureHost(url)`,
  never the full URL (it identifies the person's image).
- The resolution itself is not logged (spec §9): same answer every load, not a decision a
  reader needs to trace.

## Testing

| Spec rule                                | Test                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| §2 Google first                          | `account-avatar.test.ts` › prefers the Google account's picture                                                         |
| §2 then `hasImage`                       | › falls back to the Clerk profile image when it is a real picture                                                       |
| §2 never the default avatar              | › ignores Clerk's generated avatar when hasImage is false                                                               |
| §2 skips an empty Google image           | › skips a Google account without a picture                                                                              |
| §2 https only, per source                | › skips a Google picture that is not https, then tries the profile image                                                |
| §2 none                                  | › returns null when no source yields a usable URL                                                                       |
| §2 https only                            | › rejects http and malformed URLs                                                                                       |
| §2 96px crop on Clerk's host only        | › sizes Clerk image URLs and leaves other hosts alone                                                                   |
| Initial                                  | › derives the initial from first name, username, then '?'                                                               |
| §9 log without the URL                   | › names the host only, never the path; `AccountAvatar.test.tsx` › logs the host, not the URL...                         |
| Bridge publishes it                      | `ClerkBridge.test.tsx` › publishes the resolved profile picture                                                         |
| §5 no picture                            | `AccountAvatar.test.tsx` › shows the initial alone when there is no picture                                             |
| §5 loading                               | › keeps the initial visible and the picture transparent while loading                                                   |
| §5 loaded                                | › shows the picture over a hidden initial once it loads                                                                 |
| §5 failed                                | › falls back to the initial when the picture fails to load                                                              |
| §5 URL changes                           | › starts again from loading when a new picture arrives after a failure                                                  |
| §6, §7 decorative, no referrer, not lazy | › renders the picture decoratively without a referrer                                                                   |
| §5 no layout shift                       | › holds the same fixed box in every state                                                                               |
| Header slot holds the avatar             | `EditorHeader.test.tsx` › draws the account avatar, its initial as a glyph disc filling the slot                        |
| §3, §4, §5, §7 end to end                | `e2e/clerk-stub/profile-picture.spec.ts` › draws the Google picture in the header and the identity card, without moving |
| §5 none, no request                      | › keeps the initial when there is no picture, and asks for none                                                         |
| §5 failure, no shift, §9 log             | › falls back to the initial when the picture fails, without moving                                                      |

## Constants and configuration

| Constant             | Value                                        | Provenance                                                | Safe range |
| -------------------- | -------------------------------------------- | --------------------------------------------------------- | ---------- |
| `PROFILE_PICTURE_PX` | 96                                           | Covers the 44px card at 2x DPR and the 20px trigger at 4x | 88 to 160  |
| `CLERK_IMAGE_HOST`   | `img.clerk.com`                              | Clerk's image optimization host (spec §1)                 | fixed      |
| `IDENTITY_AVATAR_PX` | 44                                           | The identity card's existing disc size                    | fixed      |
| Stub publishable key | `pk_test_` + base64 of `clerk.stub.invalid$` | A syntactically valid key for a host that cannot resolve  | test only  |

## Assets and external resources

No assets are committed. The picture is Clerk's to serve. The e2e stub's pictures are generated
at test time (an inline SVG served by a Playwright route on `https://img.clerk.com/stub/*`).

## Defaults ledger

D1 to D5 in [DEFAULTS.md](DEFAULTS.md).
