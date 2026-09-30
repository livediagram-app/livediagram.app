# Profile picture

**Status: shipped.** A signed-in user's avatar shows their profile picture:
a picture they uploaded, else their Google picture. They see it in their own
chrome, and signed-in collaborators see it on presence avatars, cursors,
comments and team member lists, unless they turn it off. Anonymous share-link
visitors always see initials. Without a picture, or when it cannot be shown,
the avatar is the initial on its disc, exactly as before. Builds on [Auth + guest access](auth-and-guest-access.md)
(Clerk is optional) and the identity card of
[Account settings & email notifications](profile-and-email-notifications.md).

## 1. Where the picture comes from

Clerk is the only source. livediagram never talks to Google for it, never
stores the image and never proxies it: the browser reads a URL off the
signed-in Clerk user and loads the image straight from Clerk's image host.
Only the URL travels to collaborators (§6).

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

### How Clerk's image URLs name their source (observed, undocumented)

Clerk does not document how to tell a picture the person **uploaded** from
the copy of their Google picture Clerk made at sign-up: `hasImage` is true
for both. The URLs do tell them apart. Every `img.clerk.com` URL's path is
one base64url-encoded JSON object naming the image it serves, and across the
public Clerk payloads read on 2026-09-29 (webhook logs and user fixtures in
public GitHub repositories, found with a code search for
`img.clerk.com/eyJ`) the object takes exactly these shapes:

| Image                                    | Decoded path                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Generated default avatar (`hasImage` no) | `{"type":"default","iid":"ins_…","rid":"user_…","initials":"…"}`                                                                     |
| Uploaded by the person                   | `{"type":"proxy","src":"https://images.clerk.dev/uploaded/img_…"}`                                                                   |
| Copied from Google at sign-up            | `{"type":"proxy","src":"https://images.clerk.dev/oauth_google/img_…"}` (and `oauth_github`, `oauth_facebook`, … for other providers) |
| The Google account's own picture         | `{"type":"proxy","src":"https://lh3.googleusercontent.com/a/…=s1000-c","s":"…"}` on `externalAccounts[].imageUrl`                    |

The same payloads show the split the resolver relies on: `user.imageUrl`
points at a **stored copy** (`images.clerk.dev/oauth_google/…`) while the
Google external account points at **Google's live URL**
(`lh3.googleusercontent.com/…`). So the copy can go stale; the external
account is the fresher of the two.

Because the format is undocumented, it is used only to recognise a manual
upload, and only in the safe direction: a URL that does not decode to
`images.clerk.dev/uploaded/…` is treated as not a manual upload, so if Clerk
ever changes the format the Google picture simply wins again, as it would
have without this rule.

## 2. Which picture wins

The **profile picture URL** is resolved, in order (a manual choice goes over
an automatic one):

1. **A picture the person uploaded to Clerk**: `user.hasImage` is true and
   `user.imageUrl` decodes to `images.clerk.dev/uploaded/…` (§1).
2. **The Google account's picture**: the first `externalAccounts` entry with
   `provider === 'google'` and a non-empty `imageUrl`: Google's live picture
   as of the last Google sign-in.
3. **Clerk's copy**: `user.imageUrl` when `user.hasImage` is true (a copy
   from Google or another provider, with no Google account to prefer).
4. **None**: the initials avatar.

Only `https:` URLs on Clerk's image host `img.clerk.com` are accepted; any
other URL counts as no picture. That is also the host Clerk's own CSP guide
names for `img-src` ([CSP headers](https://clerk.com/docs/guides/secure/best-practices/csp-headers)).
The picture is fetched through Clerk, framed exactly as Google (or the upload)
frames it: Clerk is asked for a **size only**, `width=N&height=N`, never
`fit=crop`. Measured on 2026-09-29 against a public Clerk proxy of a Google
picture (source 1000x1000, Google's own `=s1000-c` square):
`width=96&height=96&fit=crop` returned a **160x96** band, which the round disc
then cropped again, zooming the face in by about 1.7x (RMSE 0.35 against the
source at the same size); `width=96&height=96` returned 96x96 with the same
framing as the source (RMSE 0.03, resampling only), and Clerk's proxy itself
matches Google's rendering (RMSE 0.004). Each disc offers a 96px and a 192px
source (`srcset` with `sizes` set to the disc's size), so a 44px disc is
crisp at 2x and 3x and the smaller discs reuse the 96px download.

livediagram offers no upload of its own; an upload made through Clerk (its
account portal, or an app on the same Clerk instance) is honoured.

## 3. What "automatically" means

- **First Google sign-in**: the Google picture shows on the first page after
  sign-in, to you and to the people you collaborate with. No action.
- **Google picture changed**: it shows after your next Google sign-in, at
  zero server cost. Clerk can have it no sooner (§1), and hosted sessions
  expire after at most 7 days (Clerk's default maximum lifetime), so on the
  hosted service a change shows within 7 days. Collaborators see the new one
  from their next page load or room join after that.
- **No polling.** The picture is read from the Clerk client fetch the page
  makes anyway, and the image comes from Clerk's host.

## 4. The switch: "Show my profile picture"

A toggle in **Settings > Account > You**, signed-in only, stored as
`showProfilePicture` in the synced preferences blob
([User preferences](../007-editor/user-preferences.md)), so it follows the
account across devices. Its default is one named constant,
`SHOW_PROFILE_PICTURE_DEFAULT`, set to **on**.

- **On**: collaborators who are signed in see your picture (§5).
- **Off**: everyone else sees your initials, everywhere, including rooms that
  are already open: the change goes out with the next presence update, which
  the toggle itself sends.
- **Your own chrome always shows your picture to you**, whatever the switch
  says: it is your screen.

## 5. Where it shows, and to whom

| Surface                                                                                 | You (own chrome) | Signed-in collaborators | Anonymous share-link visitors |
| --------------------------------------------------------------------------------------- | ---------------- | ----------------------- | ----------------------------- |
| Header account button, Settings > Account card                                          | always           | n/a                     | n/a                           |
| Presence avatars (header, tab bar, Collaborators, and every roster built from presence) | always           | when your switch is on  | initials                      |
| Live cursor labels                                                                      | n/a              | when your switch is on  | initials                      |
| Comment authors (thread popover, on-canvas bubbles)                                     | always           | when your switch is on  | initials                      |
| Team member lists                                                                       | always           | when your switch is on  | n/a (teams are signed-in)     |

**Signed-in collaborator** means a viewer whose own session is a verified
Clerk account: a teammate, or a signed-in person who opened a share link.
**Anonymous share-link visitor** means anyone not signed in: they always see
initials, and the server never sends them a picture URL. There is no second
switch for them.

## 6. How the picture travels

The picture is a URL, never bytes: nothing is proxied, and nothing is stored
in R2. Two server-side places hold it, both set only by the person's own
verified Clerk session and both cleared when the switch is off:

- **The participant record** (`participants.picture_url`, D1 migration
  `0058`). `PUT /api/participants/<id>/picture` sets or clears it; the caller
  must be that id's verified Clerk session (a guest header or an API token is
  refused). `GET /api/participants/<id>` returns `pictureUrl` only to a
  signed-in caller, and team member lists carry it for joined members.
  Comment authors are resolved through the same GET, by the author id the
  comment already carries.
- **The realtime room's presence.** A signed-in client's room join mints a
  one-time room ticket over authenticated REST, which records that the
  session is a verified account (`ws_tickets.account`, same migration). The
  room keeps a `picture` from a `hello` only for such a session, and sends it
  only to recipients who are themselves account sessions; everyone else gets
  the same roster without it. Turning the switch off or on sends a fresh
  `hello`, which updates the roster in place.

Trust: the room and the participant record accept only `https` URLs on
`img.clerk.com`, at most 512 characters, from a verified account. They cannot
check that the URL is that account's own picture (the api holds no Clerk
secret), exactly as the presence name is the person's own claim today. A
signed-in user could present somebody else's Clerk picture URL; they could
already present somebody else's name.

## 7. States and fallbacks

| State                                                                                     | Avatar                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Clerk disabled for the deployment (self-host)                                             | Initials everywhere, exactly as before; no image request is made.    |
| Guest                                                                                     | Initials; a guest has no picture and never sees anybody else's.      |
| Signed in, no picture resolved                                                            | Initial on the disc, exactly as before.                              |
| Picture loading                                                                           | Initial on the disc; the picture has not painted yet.                |
| Picture loaded                                                                            | The picture, cropped to the disc.                                    |
| Picture failed to load                                                                    | Initial on the disc, for the rest of that URL's life on the page.    |
| Picture URL changes                                                                       | Starts again from "loading"; a previous failure does not carry over. |
| A comment whose author id is not known yet (it arrived live and the author has not saved) | Initial, until the next load.                                        |

**No layout shift.** Every disc has the same fixed size in every state
([Layout stability](../004-interface-design/layout-stability.md)): the
initial is always rendered, and the picture is an overlay with explicit
`width` and `height` inside the same box, shown only once it has loaded. A
presence ring stays around the disc, over the picture's edge.

The identity row's note reads "Your name, email and picture come from your
account and are changed there, not here." The help article Signing In
(`apps/help/app/account-and-data/signing-in/`) and the privacy policy
(`apps/help/app/policies/privacy-policy/`) say who sees the picture, where it
comes from and how to turn it off.

## 8. Accessibility

Pictures are decorative (`alt=""`): every surface already names the person
beside or on the disc (the account button's first name, the card's full
name, a presence avatar's `aria-label`, a comment's author line, a cursor's
name pill, a member row's name). A picture carries no text to contrast; the
initials underneath keep their existing contrast.

## 9. Privacy and security

- Shown only to people you collaborate with who are signed in; people who
  open your share links without signing in see your initials.
- `https:` on `img.clerk.com` only. Every image is requested with
  `referrerpolicy="no-referrer"`, so Clerk's host never learns which
  document is open.
- The live app sends no `Content-Security-Policy` today (its worker defers
  CSP to a dedicated cycle). When one lands, `img-src` must allow
  `https://img.clerk.com`, as Clerk's CSP guide says.
- Deleting the account deletes the participant record, and with it the URL.
- Clerk disabled: nothing is published and nothing is requested.

## 10. Performance

One request per distinct person per page for a 96px crop (a few kilobytes)
from Clerk's CDN, after auth has settled. The picture adds at most 512 bytes
to a presence entry and one D1 column read to the member-list and participant
reads that already happen. A comment author's picture is one cached
`GET /api/participants/<id>` per distinct author per page, made only for
signed-in viewers. Images decode off the main thread (`decoding="async"`).

## 11. Observability and telemetry

- A picture that fails to load logs `[profile-picture] load failed` with the
  image host (never the full URL).
- The api logs `[profile-picture] rejected` with a reason (`not_account`,
  `invalid_url`) when a picture PUT or a hello picture is refused.
- Flipping the switch emits `UI` / `Toggled` /
  `ShowProfilePictureOn` / `ShowProfilePictureOff` before persisting, like
  every Settings toggle ([Telemetry](../017-telemetry/telemetry.md)).

## 12. Out of scope

- Uploading or changing the picture inside livediagram; it is managed at
  Google (or in Clerk).
- Refreshing a Google picture between sign-ins (it would need a server call
  to Google with the person's OAuth token, and a Clerk secret key the api
  does not hold).
- Verifying server-side that a picture URL is the account's own (§6).
- Pictures on the activity feed, change-log entries and exported files.
