# Profile pictures

**Status: shipped.** A person who signs in with Google wears their Google picture on their avatar, in every app
and on liveworkspace.app. The platform rules (where the picture comes from, the **Show My Google Picture** switch,
who may see it, the one URL rule and the shared `PictureDisc`) are liveworkspace's:
[liveworkspace/docs/accounts.md "Profile pictures"](../../../../liveworkspace/docs/accounts.md). This page is
livedocuments' half: how the picture reaches the editor, the room and the avatars.

## 1. The person's own picture

- The api reads the ID token's `picture` and `picture_hidden` claims into `AuthUser` (`apps/api/src/routes/auth.ts`)
  and answers them with the session (`POST /api/auth/token` → `user.picture`, `user.pictureHidden`). The readable
  `ldoc_account_picture` cookie carries the same picture for the header, beside the name and colour cookies.
- The editor keeps it in `lib/own-picture.ts`, set by `AccountsBridge` when the session arrives and moved by a
  Settings › Profile save (`onProfileSaved`'s `showPicture`), with no reload.
- Your own chrome always shows your picture to you, whatever the switch says: the account button
  (`AuthControls`), your own presence avatar and your own comments. It is your screen.

## 2. Presence: who may send one, who may see one

- The client says hello with `picture` only when it is signed in and **Show My Google Picture** is on. When the
  switch moves it sends an `identity` frame (the hello's participant again) over the open socket, so the roster
  changes for everyone at once, without a rejoin.
- The room (`helloPresence`, `document-room-rules.ts`) keeps `picture` only from an **account session**, one whose
  ticket a verified account minted (the session carries a person tag; a guest, an API token and an anonymous
  share-link visitor carry none), and only when it passes `isProfilePictureUrl`
  (`@liveworkspace/sites/picture`: Google's image host, https, at most 512 characters). It is refused whole, never
  clamped: a cut URL is a broken image. Anything else is dropped and logged (`[profile-picture] rejected`).
- The roster (`rosterFrames`, `room-roster.ts`) sends pictures only to account sessions. Everyone else gets the same
  roster with every picture removed, so the URL never reaches an anonymous visitor.
- `identity` frames go through the same rules and are ignored before the session's hello.

## 3. Participants

`GET /api/participants/<id>` answers the person's published `picture` (null when they have none or switched it
off) only to a signed-in account caller; a guest or link visitor gets the name and colour alone. The picture
comes from the same profile read as the name (`person/profiles.ts`, one batched read, remembered a minute), so it
costs no request of its own.

## 4. Where avatars show it

Every person avatar draws `PictureDisc` (from `@livedocuments/ui`, which re-exports `@liveworkspace/ui`): the
picture over the initials, at the disc's own size, lazy, sent with no referrer, falling back to the initials when
it fails or there is none. Today: presence avatars (`ParticipantAvatar`: the header, the tab stacks, Collaborators),
remote cursors' name pills, the account button and your own comments.

Not yet: other people's comment authors. A comment stores a name and colour, and the room strips author ids, so
their picture would need a lookup keyed by comment; until then they show initials.
