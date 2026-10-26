# Tab-scoped share links

**Moved to liveworkspace's index (October 2026).** A share link can open every tab or only one. The link and its tab are the index's (`ShareLink.tabId`, chosen in the shared Share dialog's Opens), and the grant the index issues for that link names the tab (`tab`).

What liveplanner still does is enforce it. The api checks a grant's `tab` on every request about the plan and the plan's room confines the socket to it (`apps/api/src/room-scope.ts`, `apps/api/src/routes/plan-grant.ts`): the other tabs are locked in the editor and refused by the server, including in the room. A grant whose tab changes on renewal closes the socket (4005) so it reconnects as what it now is. A tab op's payload keeps to the tab it names: the room drops a whole-tab op whose tab has another id and a `tab-meta` patch that names an id or elements (`apps/api/src/room-op-gate.ts`), and an editor receiving one keeps its tab's own id, so a session can never renumber its tab onto one it cannot reach. A peer's sheet selection is drawn only on the tab it names, so a scoped session's presence never shows on a sheet of a tab it cannot reach. A scoped session never changes its tab's structure (its boards, plan views, Plan cards, form targets and name), so it never widens what its tab shows: the api keeps the stored structure on a save and the room drops the op ([Structure](#structure)). Its card edits go through the items api as before.

## Structure

A tab-scoped Editor changes its tab's content, never its structure, so the link never widens what it reaches:

- **The tab's name** is structure: a scoped Editor cannot rename its tab.
- **What pulls cards onto the tab** is structure: adding or removing a Plan board, a plan view or a Plan card, pointing a Plan card at another card, or turning an element into one of them changes which cards the tab shows (items.md "Who may do what"), and so which cards the link may change and delete. Moving, resizing and setting up a board or Plan card already there is content.
- **Where its form sends responses**: on a scoped Form tab, a form's responses may go only to a board or sheet on that tab. A destination someone with wider access set elsewhere stays as it is while the form's questions change.

The api refuses each with 403 `tab_structure` on the rename route, a changeset, a revert and an agent's form write. A whole-tab save (the editor's autosave) lands everything else and keeps the stored name, Plan elements and form destination. The room drops a scoped session's op that would change them: an added Plan element, a rename and a patch to what an element pulls in from the op alone, and an update, a remove, a whole-tab op or a form pointed elsewhere against the stored tab, holding that session's later ops behind the check so they still arrive in order (`apps/api/src/tab-structure.ts`, `room-structure-gate.ts`, `room-scoped-structure.ts`).

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Grants". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
