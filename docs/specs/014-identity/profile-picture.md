# Profile picture

**Status: shipped (own chrome).** A signed-in user's avatar shows their
profile picture: for someone who signs in with Google, their Google picture.
Without a picture, or when it cannot be shown, the avatar is their initial on
the brand disc, exactly as before. Builds on [Auth + guest access](auth-and-guest-access.md)
(Clerk is optional) and the identity card of
[Account settings & email notifications](profile-and-email-notifications.md).

## 1. Where the picture comes from

Clerk is the only source. livediagram never talks to Google for it, never
stores it and never proxies it: the browser reads a URL off the signed-in
Clerk user and loads the image straight from Clerk's image host.

What Clerk's official documentation says (read 2026-09-29):

| Field                                             | Documented meaning                                                                                                                                                                                              | Source                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `user.hasImage`                                   | "Indicates whether the user has uploaded an image or one was copied from OAuth. Returns `false` if Clerk is displaying an avatar for the user."                                                                 | [User object](https://clerk.com/docs/react/reference/objects/user)                 |
| `user.imageUrl`                                   | "Holds the default avatar or user's uploaded profile image. Compatible with Clerk's Image Optimization." Always set: with `hasImage` false it is Clerk's generated default avatar, not a picture of the person. | [User object](https://clerk.com/docs/react/reference/objects/user)                 |
| `user.externalAccounts[]`                         | "An array of all the `ExternalAccount` objects associated with the user via OAuth." A Google sign-in is the entry whose `provider` is `google`.                                                                 | [User object](https://clerk.com/docs/react/reference/objects/user)                 |
| `externalAccount.imageUrl`                        | "The user's image URL", i.e. the picture the provider (Google) reported for that account.                                                                                                                       | [ExternalAccount](https://clerk.com/docs/react/reference/types/external-account)   |
| `width`, `height`, `fit`, `quality` on `imageUrl` | Query parameters that scale a Clerk image URL down; `fit=crop` scales and crops to the box; `quality` defaults to 85.                                                                                           | [Image optimization](https://clerk.com/docs/guides/development/image-optimization) |
| Session maximum lifetime                          | "enabled with a default value of 7 days for all newly created instances"; a custom value needs a paid plan in production.                                                                                       | [Session options](https://clerk.com/docs/guides/secure/session-options)            |
| `user.reload()`                                   | Fetches the latest user from Clerk. clerk-js also fetches the client (and with it the user) every time it loads, so every page load reads the user fresh from Clerk.                                            | [User object](https://clerk.com/docs/react/reference/objects/user#reload)          |

What the documentation does **not** say: when, or whether, Clerk refreshes
`externalAccount.imageUrl` or the copied `user.imageUrl` after the Google
picture changes. Enterprise SAML connections have an explicit "sync user
attributes during sign in" setting; social connections such as Google have no
documented equivalent.

What is certain, independent of Clerk, is the protocol ceiling: Google hands
a relying party the `picture` claim only when the person authenticates (the
ID token and userinfo response of an OAuth / OpenID Connect sign-in). Google
sends no change notification. So nothing downstream of Google, Clerk
included, can learn about a new Google picture before the person's next
Google sign-in, short of calling Google on their behalf.

## 2. Which picture wins

The **profile picture URL** is resolved, in order:

1. **The Google account's picture**: the first `externalAccounts` entry with
   `provider === 'google'` and a non-empty `imageUrl`. It is the most
   recently reported picture from Google, so a change at Google shows here
   first.
2. **The Clerk profile image**: `user.imageUrl`, only when `user.hasImage` is
   true. Covers a picture copied at sign-up and one uploaded in Clerk.
3. **None**: the initials avatar.

A URL is accepted only when it parses as an absolute `https:` URL; anything
else is treated as no picture. A Clerk image URL (host `img.clerk.com`) is
requested as a 96 by 96 crop (`width=96&height=96&fit=crop`), one size for
every surface so the browser fetches the picture once and reuses it; any
other host is used as given and scaled by the box.

Google first means a picture uploaded in Clerk loses to the Google one while
a Google account is linked. livediagram offers no way to upload one (the
identity card only reads Clerk), so this costs nothing today; it is the price
of a Google change showing without waiting on Clerk to copy it.

## 3. What "automatically" means

- **First Google sign-in**: the Google picture shows on the first page after
  sign-in. No action.
- **Google picture changed**: it shows on the first page load after Clerk has
  it. Clerk can have it no sooner than the person's next Google sign-in (§1),
  and hosted sessions expire after at most 7 days (Clerk's default maximum
  lifetime), so on the hosted service the change shows within 7 days, at the
  next Google sign-in. Whether Clerk refreshes the picture on that sign-in is
  undocumented; livediagram reads whatever Clerk reports and needs no change
  either way.
- **No polling, no server work.** Freshness costs livediagram nothing: the
  read is the Clerk client fetch the page makes anyway, and the image comes
  from Clerk's host.

## 4. Where it shows

Only in the signed-in user's **own chrome**, the two places that draw them to
themselves:

- the **account menu trigger** in the header (`AuthControls`), a 20px disc;
- the **identity card** in Settings > Account, a 44px disc.

Everywhere the user is drawn **to other people** keeps initials: presence
avatars in the header and tab bar, collaborator cursors, comment authors,
team member lists, the Collaborators dialog and share-visitor views. Those
travel through the realtime room and the api, which carry a name and a
colour, not a picture.

## 5. States and fallbacks

| State                                              | Avatar                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Clerk disabled for the deployment (self-host)      | No account avatar at all, exactly as before; no image request is made.   |
| Guest                                              | No account avatar (the header shows "Sign in"); the card explains guest. |
| Signed in, no picture resolved                     | Initial on the brand disc, exactly as before.                            |
| Signed in, picture loading                         | Initial on the brand disc; the picture has not painted yet.              |
| Signed in, picture loaded                          | The picture, cropped to the disc.                                        |
| Signed in, picture failed to load                  | Initial on the brand disc, for the rest of that URL's life on the page.  |
| Picture URL changes (a new one arrives from Clerk) | Starts again from "loading"; a previous failure does not carry over.     |

**No layout shift.** The disc has the same fixed size in every state
([Layout stability](../004-interface-design/layout-stability.md)): the initial
is always rendered, and the picture is an overlay with explicit `width` and
`height` inside the same box, shown only once it has loaded. Nothing around
the avatar moves when the picture arrives or fails.

The identity row's note says so: "Your name, email and picture come from your account and are
changed there, not here." The help article Signing In (`apps/help/app/account-and-data/signing-in/`)
explains the picture, its fallback and when a Google change shows.

## 6. Accessibility

The whole avatar, initial and picture alike, is decorative and hidden from
assistive technology (`aria-hidden`, `alt=""`): the account menu trigger is
already named "Account menu" and shows the first name beside the disc, and
the identity card prints the full name next to it. A lone initial or a photo
would only repeat the name. The disc keeps the brand colours of the initials
avatar, which already meet contrast; a picture carries no text to contrast.

## 7. Privacy and security

- The URL comes from the authenticated Clerk session (a trust boundary the
  app already relies on for the user's name and email), never from another
  user, a share link or the api.
- `https:` only. The image is requested with `referrerpolicy="no-referrer"`,
  so Clerk's image host never learns which diagram the person has open.
- The picture is never proxied, never written to D1, R2, `localStorage` or
  IndexedDB, and never sent to the api or the realtime room.
- The live app sends no `Content-Security-Policy` today (its worker defers
  CSP to a dedicated cycle). When one lands, `img-src` must allow
  `https://img.clerk.com`, or every profile picture falls back to initials.
- Clerk disabled: the Clerk bundle is never loaded, so no picture is ever
  requested.

## 8. Performance

One request per page for a 96px crop (a few kilobytes), from Clerk's CDN,
after auth has settled, so it never competes with the first paint. The image
decodes off the main thread (`decoding="async"`). It is not lazy-loaded: both
surfaces are on screen the moment they render.

## 9. Observability and telemetry

A picture that fails to load logs `[profile-picture] load failed` with the
image host (never the full URL). Which source won is not logged or tracked:
it is not a user action and the answer is the same on every load. No
telemetry event is added.

## 10. Out of scope

- Showing the picture to other people (§4).
- A per-user switch to hide the picture.
- Uploading or changing the picture inside livediagram; it is managed at
  Google (or in Clerk).
- Refreshing a Google picture between sign-ins (it would need a server call
  to Google with the person's OAuth token, and a Clerk secret key the api
  does not hold).
