# Share password

A canvas's share password is the index's: one password guards every link to the item (`PUT /items/:id/share-password`),
set, changed or removed in the shared Share dialog's **Password Protection**, by the owner or a joined member of the
canvas's team. The index keeps it hashed and never returns it. The point is to stop people guessing share URLs, not
to provide cryptographic protection.

**A listed Community post locks it.** A canvas listed on the Community cannot be put behind a password, and a canvas
behind a password cannot be published: in the editor's Share, Password Protection is locked while the canvas's post
is listed ("Remove it from the Community to set a password."), and the Community band says why it cannot publish
while a password is set (`apps/editor/components/dialogs/community/ShareDialogWithCommunity.tsx`,
[Community](../025-community/community.md)).

## The visitor

A link visitor whose link needs a password sees the password gate
(`apps/editor/components/dialogs/SharePasswordGate.tsx`), a full-screen card with a lock, one password input and an
error line, in place of the canvas. On submit the editor keeps the password for the tab's session
(`setSessionSharePassword`, `apps/editor/lib/api/core.ts`) and loads again. The password then rides every request
about the canvas as `X-Share-Password` beside `X-Share-Code`, and the api hands both to the index when it asks for a
grant ([API](../015-api/api.md)). The index answers 401 `password_required` or 403 `password_invalid`, which pass
through, and the gate says which. A room join carries no password: the grant the visitor already holds admits it.

- **Remembered per link.** The accepted password is kept in `localStorage` under
  `livehuddle:share-password:<code>` (`readCachedSharePassword` / `writeCachedSharePassword`), read at the start of
  a share-link load so the first request already carries it, written after each accepted load, and cleared when the
  index refuses it (the password was changed or removed), so the gate shows afresh and a stale value never loops.
  Plain text in the visitor's own browser matches the threat model: anyone able to read it can already open the
  canvas there. In an embed, browsers partition the iframe's storage, so the cache is per embedding site
  ([Read-only embeds](embeds.md)).
- **Reopened by its own address.** A visitor who opened the canvas through a password-protected link and reopens it
  by its own address (`/document/<id>`, from Shared with me, Recent or a bookmark) sends no code. The index's grant
  refusal then names the link (`401 password_required` with `link`, liveworkspace
  [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Reopened
  without the code"), and `openOwnAddress` opens the canvas through that link: the password remembered under its code
  opens it straight away, and with none (or a changed one) the password gate shows, never Not Found. Each try at the gate goes straight through that link, not the refused own-address load again, and that refusal is not counted as an api error. The address
  stays the canvas's own; the visitor opens at the link's level and tab, carrying its code.
- **Quiet while the gate is up.** The participant fetch, the capabilities check and the preferences sync wait until
  the gate passes, so a wrong password costs one request per attempt.
- **A changed password ends link sessions.** Setting or changing it closes every room session a share code admitted
  (`4005`, "access changed"); their editors reload and meet the gate. The owner's and team members' sessions are
  untouched, and removing it closes nobody.

## Restricted to accounts

Beside the password, the space can carry the index's sign-in rule (`PUT /items/:id/share-sign-in`, liveworkspace
[one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and
access", Work Tracker 1330 and 1331): **Require Sign In** (accounts only, no guests) and **Anybody With Email Address
Domain** (only accounts whose verified email is at a listed domain, which implies sign-in). Like the password it is one
rule over every link, set in the shared Share dialog's Sign In card, just under Password Protection, by the owner or a
joined member of the space's team; a listed Community post locks it, and a space behind it cannot be published.

- **The restricted page.** The index refuses a guest or nobody `401 sign_in_required` and an account at another
  domain `403 domain_not_allowed`, each with the rule's `domains`, before it reads the password and never with the
  space's content. The share resolve (`apps/editor/lib/api/share.ts`, through `shareGateOf` in
  `@liveworkspace/workbench/lib/share-restriction`) turns either into the gate with `restricted`, and the password
  gate's place shows the restricted page instead (`ShareRestricted` in the workbench, titled "Sign In Required"): Sign
  In and Create Account for a guest, Use Another Account (`screen=switch`, `prompt=login`) for another domain's
  account. Each comes back to the same address, where the link opens with its role. A remembered password is kept: the
  rule refused the visitor, not it.
- **In an embed** the restricted page's links open the accounts site in a new tab (it refuses framing), and the embed
  opens once reloaded signed in.
- **Sessions stop.** Turning the rule on, or narrowing it, closes every room session a share code admitted (the
  index's `rescoped`), so a guest already inside meets the restricted page on reload.
- **API clients.** `POST /api/documents/:id/share` takes `requireSignIn` and `domains`, set on the space before the
  link is made; naming neither leaves the rule as it is.

## Telemetry

The shared dialog reports through livehuddle's `trackShare` (`apps/editor/lib/explorer-share-host.ts`): setting a
password is `Document` · `Shared` · `PasswordSet`, clearing it `Document` · `Shared` · `PasswordCleared`. The type is
a preset string, never the password.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
