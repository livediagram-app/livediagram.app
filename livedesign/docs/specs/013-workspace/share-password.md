# Share password

A design's share password is liveworkspace's index's: one password guards every link to the item (`PUT /items/:id/share-password`), set, changed or removed in the shared Share dialog. The index keeps it hashed and checks it when a link visitor asks for a grant.

What livedesign does is ask for it. A link visitor whose link needs a password sees the password gate (`../packages/workbench/src/components/dialogs/SharePasswordGate.tsx`, in this product's word through `apps/live/components/dialogs/SharePasswordGate.tsx`); the password is kept for the tab's session and sent with the share code (`X-Share-Code`, `X-Share-Password`) when the editor asks the index for a grant. The index answers 401 `password_required` or 403 `password_invalid`, and the gate says which.

**Reopened by its own address.** A visitor who opened the design through a password-protected link and reopens it by its own address (`/design/<id>`, from Shared with me, Recent or a bookmark) sends no code. The index's grant refusal then names the link (`401 password_required` with `link`, [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Reopened without the code"), and `openOwnAddress` (`@liveworkspace/workbench/lib/editor-arrival`) opens the design through that link: the password this browser remembers under its code opens it straight away, and with none (or a changed one) the password gate shows, never Not Found. Each try at the gate goes straight through that link, not the refused own-address load again, and that refusal is not counted as an api error. The address stays the design's own; the visitor opens at the link's level and tab, carrying its code.

The plan is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).

## Restricted to accounts

Beside the password, the design can carry the index's sign-in rule (`PUT /items/:id/share-sign-in`, liveworkspace
[one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and
access", Work Tracker 1330 and 1331): **Require Sign In** (accounts only, no guests) and **Anybody With Email Address
Domain** (only accounts whose verified email is at a listed domain, which implies sign-in). Like the password it is one
rule over every link, set in the shared Share dialog's Sign In card, just under Password Protection, by the owner or a
joined member of the design's team; a listed Community post locks it, and a design behind it cannot be published.

- **The restricted page.** The index refuses a guest or nobody `401 sign_in_required` and an account at another
  domain `403 domain_not_allowed`, each with the rule's `domains`, before it reads the password and never with the
  design's content. The share resolve (`apps/live/lib/api/share.ts`, through `shareGateOf` in
  `@liveworkspace/workbench/lib/share-restriction`) turns either into the gate with `restricted`, and the password
  gate's place shows the restricted page instead (`ShareRestricted` in the workbench, titled "Sign In Required"): Sign
  In and Create Account for a guest, Use Another Account (`screen=switch`, `prompt=login`) for another domain's
  account. Each comes back to the same address, where the link opens with its role. A remembered password is kept: the
  rule refused the visitor, not it.
- **In an embed** the restricted page's links open the accounts site in a new tab (it refuses framing), and the embed
  opens once reloaded signed in.
- **Sessions stop.** Turning the rule on, or narrowing it, closes every room session a share code admitted (the
  index's `rescoped`), so a guest already inside meets the restricted page on reload.
- **Agents.** The MCP's share tool and the CLI's `share` take `requireSignIn` and `domains`, set on the design before
  the link is made; naming neither leaves the rule as it is.
