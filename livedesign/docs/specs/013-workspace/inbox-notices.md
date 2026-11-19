# Inbox notices

While someone works in a design, a new row in their Inbox (a mention, a comment on their work, a card or action
handed to them, someone asking for access to an item they manage, an item shared with them) shows as a small notice
under the editor's top-right corner card, with a link that opens the Inbox at that row (or, for an access request
or a share, the item). The whole design is liveworkspace's
[inbox-notices.md](../../../../liveworkspace/docs/specs/004-index/inbox-notices.md): which rows notify, the one read
per browser, how a notice looks, groups and goes away, and the seen rows kept across tabs.

What livedesign does:

- **The door.** The editor's Explorer button (`apps/live/components/chrome/ToolbarExplorerButton.tsx`) calls `useEditorInbox('livedesign')`
  (`@liveworkspace/workbench`), which turns notices on for a signed-in account and off for a guest. It draws the
  Inbox's count as a badge on the button ("Explorer, 3 in Inbox") and the notice layer beside it. Where the menu card
  is not drawn (Zen, an embed, the workbench frame) there are no notices.
- **Every role alike.** A Viewer, a Participant and an Editor of this design hear the same: only their own Inbox,
  whatever they can do here.
- **Its rows.** The rows are those the design's Durable Object pushes to the index ([inbox.md](inbox.md)), so a
  notice follows the index by up to a minute (the outbox's gap) and a read (every 30 seconds while someone is there).
- **Its link.** A thread's or an action's notice opens `/explorer/inbox?at=<row>` on this address (another app's row
  on that app's address), where the Inbox opens its pane on the row; an access request's or a share's opens the item.
