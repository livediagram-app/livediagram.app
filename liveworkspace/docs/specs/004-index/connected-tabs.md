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

From an editor's start screen, **Connect File** (the start screen's sidebar's foot entry, pinned
to its very bottom under a hairline, apart from the categories; an app may draw its own entries above or below it in
the same foot group, in its row's look (liveplanner's Describe a Plan above, its Import below), and Connect File itself
stays as every app draws it; on a phone the last chip of the row; on one line, led by every
app's logo stacked, overlapping, where a row's icon goes, the host's too) lists the person's most recent items across every app
(the index's Recent, the host itself left out), each with its app's logo. Above the list:

- **Role**: the level the pass grants, Editor first and chosen, then Participant and Viewer. The role is picked
  before the file. No line shows under it; a screen reader hears what it means with the control: "Anyone who can open
  this <host kind> can edit the file you connect." A file whose app does not offer the chosen role (livehuddle has no
  Viewer) is listed but cannot be picked while it is chosen, saying so ("livehuddle has no Viewer role").
- **Add connection to both files**: off by default, with no line under it; a screen reader hears what it does, or
  why it cannot be turned on, with the switch. In a start panel drawn in its tab's theme, the switch takes the theme's
  colours on and off, as the panel's other switches do.
- **Find a file**: narrows the list by name as the person types.

One tap on an item connects it. The host gains a connected tab at the end of its tab bar, loose, and it becomes the
open tab at once, showing its page ready to open the file (below). The empty tab the start screen was on gives way to
it (one change, so undo brings that tab back), unless it is the item's only tab, so a tab added only to connect a file
leaves no blank tab behind. An item the host is already connected to is marked
Connected; a tap on it goes to that tab rather than making a second. When both ways was asked and the other file
could not be reached, a toast says so ("<name> could not be reached, so it has no tab back here."); the host's tab
stands.

The entry shows only where connecting can work: the person is signed in, the item is on the server (not a This
Browser item), and the session may change its tabs (an Editor's, not a tab-scoped link's, an embed's, a workbench's
or a Community visitor's). Elsewhere the sidebar has no such entry.

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

A connected tab opens its file only when a person presses Open on its page, under the file's preview. Pressing the
tab itself only makes it the open tab: its page shows **ready**, with the preview and Open, and goes nowhere by
itself, so a person looks at the file's picture first and chooses to go. The same holds however else it becomes the
open tab (the editor loading on it, the tab just connected, a tab closed beside it, undo), so reloading a host whose
open tab is connected to the same app never sends the reader away in a loop.

A connected tab that opens nothing says why, in place of the target, with what can be done:

| Why                                                      | Shown                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| The target is in the Trash, or gone                      | "This file is no longer there." Remove                      |
| Its pass was deleted (from the target's Share) or lapsed | "This connection's link was removed." Connect Again, Remove |
| The tab came with a copy, an export or an import         | "Connect this copy to <name>." Connect Again, Remove        |
| The host is offline (a This Browser item, or no network) | "Connected files open when you are online."                 |

Connect Again makes a new connection to the same target in the same tab, under the same rules as connecting.

## How it looks

Every app draws the connected tab and the Connect list from one shared place (`packages/workbench`), so they look
and behave alike everywhere.

**The tab.** A tab like its neighbours, in the same shape and slots, led by the target app's logo (its Living Prism,
the size of a tab's padlock) before the name. A target in another app carries a small arrow after the name, saying
it opens in a new browser tab; one in the same app carries none. A tab that opens nothing carries a small amber dot
in place of the arrow, so a broken connection shows without opening it. Its name is never renamed by hand, so a
double-click does nothing; a screen reader hears "<name>, connected <app> file" (or "connected
file, needs attention"); pressing it opens nothing, so it never says where the file opens. It is dragged, foldered and selected like any tab (selecting it shows its page; the file opens from Open there), and its menu offers, as plain rows, Connect Again
(only when it opens nothing), Organise in Tab Folder and, last under a hairline, Remove Tab; never Duplicate.

**The tab's page.** Opened, a connected tab shows one calm card in place of a canvas: the target's preview (the
same picture the Explorer shows of it, never more visible than the file), the target app's logo on its lower edge, then
the target's name and a line. Shown, the page asks the index once where the tab leads, as Open would but going
nowhere, and draws the picture its answer names; a file reached through the connection's link shows that link's
picture. While it is asked for, the picture's place shows a quiet placeholder; a file with no picture (empty, gone,
its link removed, the host offline, or the index out of reach) shows the logo alone, as before. A visitor whose share link lands on a connected tab is asked for their name first, as on any
tab, and sees the card once they have joined:

| State                                | Line                                         | Actions (an Editor)       |
| ------------------------------------ | -------------------------------------------- | ------------------------- |
| Ready (not yet opened)               | "A connected <app> file."                    | Open (everyone)           |
| Opening                              | "Opening <name> in <app>…", the logo turning | none                      |
| Opened in a new tab (another app)    | "<name> is open in a new tab."               | Open Again                |
| Opened in place (the same app)       | the target itself; no card                   | none                      |
| The target in the Trash, or gone     | "This file is no longer there."              | Remove Tab                |
| Its pass deleted or lapsed           | "This connection's link was removed."        | Connect Again, Remove Tab |
| A copy's, an export's or an import's | "Connect this copy to <name>."               | Connect Again, Remove Tab |
| Offline                              | "Connected files open when you are online."  | none                      |
| Anything else (the network, limits)  | "<name> could not be opened just now."       | Try Again                 |

A connected tab holds no content: its page stands where the canvas would be, so nothing is drawn, typed or pasted
onto it (the editor blocks every edit on it, as on a locked tab), and the empty tab's start screen never shows on it.

Open Again exists because a browser may block a new tab it did not see a click make. A Participant or Viewer sees the
same card without Remove Tab or Connect Again (Remove Tab takes the tab away and never touches the file), and is
told "Ask an editor to connect it again" where only an editor can mend it; Open Again and Try Again are everyone's.

**The Connect list.** On the start screen's Connect File, in the start panel's own colours: the title,
the role as a three-way switch, the both-ways switch (each with no line under it; its words, "The file you connect gets
a tab back to this <host kind>." when allowed, else why not, are the switch's description for a screen reader), Find a file, then Recent, one row per file: its app's logo on a tile, its
name, and its app and when it was last opened. A row is pressed once to connect. While it connects it shows a spinner
and the rest wait; a row already connected says Connected and goes to its tab; a row that cannot be picked is dimmed
and says why; a failure says why on the row, in words ("This file has too many links already."), and leaves the list
as it was. Loading shows quiet placeholder rows; nothing recent says so with a way to the Explorer; a failed load says
so with Try Again.

## Removing

Removing a connected tab (its tab menu's Remove, the same as any tab) removes the tab and nothing of the target. The
host app tells the index once the tab has left the host, however it left (the editor, an agent, an offline copy
syncing, an undo that never came back), and the index deletes the connection and its pass: everyone it let in is
sent away from the target as with any deleted link. The telling goes through the host's outbox, written with the
delete itself, so an index out of reach then is told later, with the outbox's retries (Work Tracker #618). It names
the connection's own id and the tab, so a later connection made in the same tab (Connect Again) is never the one
removed. Undoing the removal brings the tab back without its pass; it
offers Connect Again.

Moving the host to the Trash keeps its connections; purging it deletes them and their passes. Moving the target to
the Trash leaves its connected tabs saying so; purging it deletes its passes with its links, and its connections stay
behind saying the file is no longer there until their tabs are removed (or their host is purged), so the tab says why
rather than reading as a copy's.

Undoing a removal never restores access (Work Tracker #572): a grace period before the pass goes would leave a live
share link nobody can see. The tab comes back offering Connect Again.

A pass can also be deleted from the target's Share dialog, where it is listed as "Connected from <host>" (the host
app's logo and the host's title, on the pass under its link): the connected tab then offers Connect Again.

## Telemetry

Each editor counts, under its own app, through the shared workbench code: `Tab·Added·Connected` (a file connected one
way), `Tab·Added·ConnectedBoth` (both ways asked), `Tab·Added·ConnectedAgain` (Connect Again) and
`Tab·Opened·Connected` (a person opened a connected tab). Never a name, an id or an app: the question is whether
people connect files and follow them.

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
  its address is built from the registry, so it cannot lead elsewhere. A copy through a Community link keeps no
  connection, and a Community visitor reads none: a stranger is told of no other item.
- **A connected tab stays in its host.** It is never shared into another item (a tab shared between items), and a
  tab of content is never turned into one: only a new tab, or one already connected (Connect Again), takes a
  connection.
- **The cross-app write is narrow.** The only write into another app's item is the reverse tab: the index calls the
  target app's internal door with that app's own key (`INDEX_KEY`, as for revocations), carrying one connected tab and
  nothing else. The app appends it at the end of the tab bar, never replaces or edits an existing tab, refuses a
  malformed connection, does nothing a second time for the same connection id, and refuses past
  `CONNECTIONS_PER_ITEM`. The index makes that call only after checking the person may manage the host's links and
  edit the target, in the same request; the tab's name is the host's title as the index has it, not the browser's.
- **Removing only takes access away.** Anyone who may edit the host may remove its connected tab, which deletes a
  pass on a target they may not own. That narrows who reaches the target and never widens it; the target's History
  shows it as `unshared`.
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
API token's, the Drive mirror, the data export) at both the make and the open door. Only two writes put a new `connection` on a tab: the
editor's add after the index made the connection, and the index's reverse write. A copy, the Drive file and an
editor's create (an Offline Mode sync) carry the one a tab already had. An agent's or the API's tab write (a
changeset, a token's create) keeps none, and a well-formed one is read as exactly `{id, app, itemId}`, anything else
in it dropped.
