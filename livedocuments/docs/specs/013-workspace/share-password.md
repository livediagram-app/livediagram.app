# Share password

**Moved to liveworkspace's index (October 2026).** A document's share password is the index's: one password guards every link to the item (`PUT /items/:id/share-password`), set, changed or removed in the shared Share dialog. livedocuments' password columns, its hashing and its password routes are gone.

What livedocuments still does is ask for it. A link visitor whose link needs a password sees the password gate (`apps/editor/components/dialogs/SharePasswordGate.tsx`); the password is kept for the tab's session and sent with the share code (`X-Share-Code`, `X-Share-Password`) when the editor asks the index for a grant. The index answers 401 `password_required` or 403 `password_invalid`, and the gate says which.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
