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
  `livediagram:share-password:<code>` (`readCachedSharePassword` / `writeCachedSharePassword`), read at the start of
  a share-link load so the first request already carries it, written after each accepted load, and cleared when the
  index refuses it (the password was changed or removed), so the gate shows afresh and a stale value never loops.
  Plain text in the visitor's own browser matches the threat model: anyone able to read it can already open the
  canvas there. In an embed, browsers partition the iframe's storage, so the cache is per embedding site
  ([Read-only embeds](embeds.md)).
- **Quiet while the gate is up.** The participant fetch, the capabilities check and the preferences sync wait until
  the gate passes, so a wrong password costs one request per attempt.
- **A changed password ends link sessions.** Setting or changing it closes every room session a share code admitted
  (`4005`, "access changed"); their editors reload and meet the gate. The owner's and team members' sessions are
  untouched, and removing it closes nobody.

## Telemetry

The shared dialog reports through livediagram's `trackShare` (`apps/editor/lib/explorer-share-host.ts`): setting a
password is `Document` · `Shared` · `PasswordSet`, clearing it `Document` · `Shared` · `PasswordCleared`. The type is
a preset string, never the password.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
