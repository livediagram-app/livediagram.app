# Share password

A design's share password is liveworkspace's index's: one password guards every link to the item (`PUT /items/:id/share-password`), set, changed or removed in the shared Share dialog. The index keeps it hashed and checks it when a link visitor asks for a grant.

What livedesign does is ask for it. A link visitor whose link needs a password sees the password gate (`apps/live/components/dialogs/SharePasswordGate.tsx`); the password is kept for the tab's session and sent with the share code (`X-Share-Code`, `X-Share-Password`) when the editor asks the index for a grant. The index answers 401 `password_required` or 403 `password_invalid`, and the gate says which.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
