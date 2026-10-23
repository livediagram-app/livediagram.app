# Tab-scoped share links

**Moved to liveworkspace's index (October 2026).** A share link can open every tab or only one. The link and its tab are the index's (`ShareLink.tabId`, chosen in the shared Share dialog's Opens), and the grant the index issues for that link names the tab (`tab`).

What livedocuments still does is enforce it. The api checks a grant's `tab` on every request about the document and the document's room confines the socket to it (`apps/api/src/room-scope.ts`, `apps/api/src/routes/document-grant.ts`): the other tabs are locked in the editor and refused by the server, including in the room. A grant whose tab changes on renewal closes the socket (4005) so it reconnects as what it now is.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Grants". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
