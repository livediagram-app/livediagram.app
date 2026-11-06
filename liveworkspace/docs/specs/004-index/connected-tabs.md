# Connected tabs

A **connected tab** is a tab in one item that stands for another item, in any app: a diagram's tab bar holds a tab
showing liveplanner's logo and the plan's name, and clicking it opens the plan. It lets a person jump from one part
of a project to another wherever each part lives. The person connecting chooses the role anyone opening it gets,
Editor unless they change it, and may connect both ways at once, so the other item gains a tab back.

Built in parts (Work Tracker #569). What each part brings is in the blueprint's
[Build order](blueprints/connected-tabs.md#build-order); until a part lands, what it describes is not reachable.

## Names

- The **host** is the item whose tab bar holds the connected tab; the **target** is the item it stands for. Host and
  target may be in the same app or different ones, never the same item.
- A **connection** is the index's record of one connected tab: its host and the host tab holding it, its target, and
  the share link made for it. Each has an id (`TabConnection.id`).
- The share link a connection makes is its **pass**: an ordinary share link on the target
  ([Sharing and access](one-explorer-contracts.md#sharing-and-access)), marked as the connection's.
- **Both ways**: two connections made together, one on each item, each the other's **pair**.

## What a connected tab is

A connected tab is a tab like any other in its host: it has a place in the order, it can sit in a tab folder, it can
be dragged, and it can be removed. It has no content of its own. It shows the target app's logo and the target's
name, and its name follows the target's (it is not renamed by hand).

The host app keeps on the tab only what is not secret, `TabConnection = {id, app, itemId}`: which connection, and
which app and item it stands for (`packages/index-client` `connections.ts`). The pass's code is never kept in the
host. It lives on the index and is handed out, one open at a time, to someone who may read the tab. So a host's
exports, copies, offline copies, Community copies, agents' reads and every tab list carry no way into the target.

## Connecting

From an editor's start screen, **Connect liveworkspace File** lists the person's most recent items across every app
(the index's Recent, the host itself left out), each with its app's logo. Above the list:

- **Role**: the level the pass grants, Editor first and chosen, then the target app's other offered levels
  (`APP_LINK_LEVELS`). The line under it says plainly what it means: "Anyone who can open this file can edit
  <target>."
- **Add connection to both files**: off by default.

One tap on an item connects it. The host gains a connected tab at the end of its tab bar, loose, and it opens in the
host at once as a tab would. An item the host is already connected to is marked Connected; a tap on it goes to that
tab rather than making a second.

Who may connect:

- To add the tab, Editor on the host (its grant at `edit`).
- To make the pass, the right to manage the target's share links: its owner, or a joined member of its team. Items
  the person may not share are listed but cannot be picked, saying why ("Only its owner can share it").
- Both ways also needs the right to manage the host's share links, and Editor on the target (which managing gives).
  When the person lacks it, the switch is off and says why.

The index checks every one of these itself when the connection is made, from the person's token and the host's
grant, never from what the editor says it may do.

A connection stands once its tab is in the host. The host app tells the index when it has put the tab in (it
**confirms** the connection), and the index's reverse write confirms the reverse once the target app answers. When the
editor's add fails after the index made the connection, the editor takes it back at once, and its pass goes with it.
A connection still unconfirmed an hour after it was made (the editor closed mid-add, say) is swept by the index with
its pass, so a pass never outlives a tab that never appeared.

## Both ways

Both ways makes the pair in one request: a pass on the target and the host's connected tab, and a pass on the host
and a connected tab at the end of the target's tab bar, at the same role. The index writes the target's tab through
the target app's internal door (below); people with the target open see it arrive. If that write fails, the reverse
connection and its pass are taken back and the person is told the other file could not be reached; the host's own
connection stands.

A pair is two connections: removing either tab leaves the other.

## Opening

Clicking a connected tab asks the index for it with the host's grant. The index answers only when the grant is for
the connection's host, covers the tab holding it (a tab-scoped grant for another tab sees nothing) and did not come
through a public link (a Community post's). It answers the target's app, its current name and where to go:

- the target's own address when the reader reaches the target themselves (its owner, or a member of its team);
- else the pass's share address (`${site}${sharePath}<code>`, from `packages/sites`), which opens at the pass's role
  and asks for the target's share password when it has one, as any link does.

The address is always built by the index from the sites registry and the stored ids, never kept or taken as text, so
a connected tab can only ever lead to one of our apps. A target in another app opens in a new browser tab; one in the
same app opens in place. When the name the index answers differs from the tab's, an Editor's editor renames the tab
to match.

A connected tab that opens nothing says why, in place of the target, with what can be done:

| Why                                                      | Shown                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| The target is in the Trash, or gone                      | "This file is no longer there." Remove                      |
| Its pass was deleted (from the target's Share) or lapsed | "This connection's link was removed." Connect Again, Remove |
| The tab came with a copy, an export or an import         | "Connect this copy to <name>." Connect Again, Remove        |
| The host is offline (a This Browser item, or no network) | "Connected files open when you are online."                 |

Connect Again makes a new connection to the same target in the same tab, under the same rules as connecting.

## Removing

Removing a connected tab (its tab menu's Remove, the same as any tab) removes the tab and nothing of the target. The
host app tells the index once the tab has left the host, however it left (the editor, an agent, an offline copy
syncing, an undo that never came back), and the index deletes the connection and its pass: everyone it let in is
sent away from the target as with any deleted link. Undoing the removal brings the tab back without its pass; it
offers Connect Again.

Moving the host to the Trash keeps its connections; purging it deletes them and their passes. Moving the target to
the Trash leaves its connected tabs saying so; purging it deletes its passes with its links, and its connections stay
behind saying the file is no longer there until their tabs are removed (or their host is purged), so the tab says why
rather than reading as a copy's.

Undoing a removal never restores access (Work Tracker #572): a grace period before the pass goes would leave a live
share link nobody can see. The tab comes back offering Connect Again.

A pass can also be deleted from the target's Share dialog, where it is listed as "Connected from <host>": the
connected tab then offers Connect Again.

## Security

- **The pass widens who reaches the target, on purpose.** Anyone who can open the connected tab in the host,
  whatever their role there (a Viewer included), gets the pass's role on the target. The role picker says so in
  words, and the default is Editor because the person asked for that. Only someone who may already share the target
  can make a pass to it.
- **The code stays on the index.** It is handed to a reader of the host per open, with `Cache-Control: no-store`, and
  never written into the host's content, its exports, its copies, its Community post, an agent's read or a webhook.
  A public (Community) link's grant opens no connection; a tab-scoped grant opens only a connection in its tab.
- **Copies carry nothing.** A tab copied into another item keeps `{id, app, itemId}`, and the index refuses that id
  anywhere but its own host and tab. A tab forged by hand (an edited export, say) holds ids that open nothing, and
  its address is built from the registry, so it cannot lead elsewhere.
- **The cross-app write is narrow.** The only write into another app's item is the reverse tab: the index calls the
  target app's internal door with that app's own key (`INDEX_KEY`, as for revocations), carrying one connected tab and
  nothing else. The app appends it at the end of the tab bar, never replaces or edits an existing tab, refuses a
  malformed connection, does nothing a second time for the same connection id, and refuses past
  `CONNECTIONS_PER_ITEM`. The index makes that call only after checking the person may manage the host's links and
  edit the target, in the same request; the tab's name is the host's title as the index has it, not the browser's.
- **Removing only takes access away.** Anyone who may edit the host may remove its connected tab, which deletes a
  pass on a target they may not own. That narrows who reaches the target and never widens it; the target's owner sees
  it on the Timeline as `unshared`.
- **Passes are links.** They count towards the target's `SHARE_LINKS_PER_ITEM`, are rate limited, closed by its
  share password, never expire unless changed in Share, and are listed in its Share dialog, so its owner sees and can
  end every way in.
- **Opens are limited.** The open door is rate limited per caller, and a connection id is random, so ids cannot be
  walked.

## Limits

- At most `CONNECTIONS_PER_ITEM` (50) connected tabs in one host; past it, `409 connection_limit`.
- An item cannot be connected to itself (`400 connection_self`).
- A role the target's app does not offer is `400 level_not_offered`, as for any link.

## Agents and the CLI

Agents and the CLI read connected tabs (their app and name, never a code) and cannot make them: making a connection
mints a share link, which an agent does through Share, on purpose. The index refuses an app acting for a person (an
API token's, the Drive mirror, the data export) at both the make and the open door. Only two writes put a `connection` on a tab: the
editor's add after the index made the connection, and the index's reverse write. An agent's or the API's tab write
keeps none, and a well-formed one is read as exactly `{id, app, itemId}`, anything else in it dropped.
