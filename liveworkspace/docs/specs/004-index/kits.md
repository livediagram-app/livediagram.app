# Project kits

A **kit** starts a project across the apps in one go: a plan, a kick-off deck, a diagram and a Space, say, each made
from one of its app's templates, filed together in a new folder and joined by [connected tabs](connected-tabs.md), so
from any one of them a person reaches the others. Templates are per app; a kit is the suite's own starter, the way
Notion's and ClickUp's project templates make linked pages, boards and docs at once (Work Tracker #941).

A kit is ready-made: people pick one from the catalogue, never save their own (saving your own team template was
cancelled).

## Names

- A **kit**: an entry of the catalogue (`KITS`, `packages/index-client` `kits.ts`), with a title, a line saying what
  it is for, and its **parts**.
- A **part**: one item the kit makes: its app, the app's template it starts from, and its name ("Plan",
  "Kick-off Deck"). Each part has a **slot**, its key within the kit (`plan`, `deck`), so a retry knows which parts
  are made.
- A **run**: one person starting one kit, from the first item to the last connection.

## The catalogue

The catalogue is data in `packages/index-client`, read by the site (to show the kits) and by the index (to make
them), so both always agree on what a kit holds. Each kit has two to four parts in different apps. A kit names a
template by its kind, the same `?template=` kind each app's `/new` takes; every kind a kit names is a template its app
has, checked by a test in each app (below), so a renamed or retired template breaks the build, never a run.

| Kit              | Parts                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Software Project | Plan (liveplanner `project-planner`), Architecture (livediagram `system-architecture`), Design Doc (livedocuments `design-doc`), Team Space (livehuddle `team-pod`)             |
| Product Launch   | Launch Plan (liveplanner `product-launch`), Launch Keynote (livedocuments `launch-keynote`), Roadmap (livediagram `roadmap`), Launch Room (livehuddle `all-hands-hall`)         |
| Team Workshop    | Kick-off Deck (livedocuments `workshop-kickoff`), Affinity Map (livediagram `affinity-map`), Retro Board (liveplanner `team-retro`), Workshop Room (livehuddle `training-room`) |
| Website Build    | Build Board (liveplanner `kanban`), Wireframes (livedesign `wireframe-website`), Site Brief (livedocuments `article`)                                                           |

## Starting a kit

Signed in only: a kit makes items, folders and share links, which a guest cannot keep. A guest (or anyone signed out)
sees the kits with a prompt to sign in, which brings them back to the same page. An app acting for a person (an API
token's, the Drive mirror, the data export) cannot start one: agents make items through their own apps.

The person picks a kit, names the project (the kit's title until they type, at most `KIT_NAME_MAX`, 60 characters,
so a part's name, the project's and the part's together, stays short enough for any app's title), and picks the
**role** the kit's connections give: Editor first and chosen, then Participant and Viewer, as Connect File offers them
(owner's choice, 2026-11-15). Their words for a screen reader: "Anyone who can open one of these files can edit the
others." (Participant: "take part in", Viewer: "view"). Then one press, **Create Project**, makes the run. A
refusal shows under the button, as wide as it on a phone (Work Tracker 1235), and kept to the button's column beside
the fields from `md`:

1. **The folder.** A new folder at the top of the person's own My Work, named for the project.
2. **The items.** Each part, at once, through its app's internal door (below): a new item of the person's own, in
   that folder, made from the part's template, named "<project> <part>" (capped as every title is), its source
   `template`.
3. **The connections.** Every part connected to every other, both ways: in each item, a connected tab for each of the
   others, at the end of its tab bar, in the kit's order, each with its pass at the chosen role. Three parts make six
   connections, four make twelve. A part whose app does not offer the role (livehuddle has no Viewer) gets its app's
   nearest offered role below it, Participant for a Viewer kit, and the screen says so before Create ("livehuddle
   has no Viewer role, so its Space opens to Participants.").

The items are the person's own, made as they would make them one by one: anything they could do to an item made in
its app, they can do to these, and a kit gives nobody else any access. The passes widen who reaches each item exactly
as connected tabs do (anyone who can open one item gets the chosen role on the others) and, like every pass, are
listed in each item's Share dialog as "Connected from <item>", where they can be deleted.

When the run is done the page shows the folder's items, each with its app's logo and an Open link, and **Open
Folder**, which opens the folder in the Explorer.

## When part of it fails

A run is not one transaction: it reaches up to five Workers. Each step either lands or is reported, and nothing is left
half made inside one item:

- **An item that could not be made** (its app unreachable, a timeout, a refusal) is reported by name; the others
  stand. No connection is made to or from it.
- **A connection that could not be made** (its tab not written) is taken back with its pass, as a connected tab's
  failed reverse is; the rest stand.

The page then shows what was made and what was not, with two ways on:

- **Retry**: runs the kit again into the same folder, at the same role, making only what is missing: the parts not
  made and the connections not made. What was made is named in the request, and the index checks each is the
  person's own, in that folder, of the part's app, and live; anything that does not check is made again.
- **Remove What Was Made**: deletes every item the run made for good (not to the Trash: they are empty starters, made a
  moment ago), with their connections and passes, and the folder when nothing else is in it.

Leaving the page keeps what was made, in its folder, as any items are kept.

## Limits

- One run makes at most `KIT_PARTS_MAX` (4) items and `KIT_PARTS_MAX × (KIT_PARTS_MAX − 1)` (12) connections, so
  each item gains at most three connected tabs and three passes, within `CONNECTIONS_PER_ITEM` and
  `SHARE_LINKS_PER_ITEM`.
- An unknown kit, a role that is not a role, a project name that is empty or too long, or a folder that is not the
  person's own is refused before anything is made.
- A person starts at most 10 runs a minute, a Retry counting as one (`POST /kits`, per person, the
  index's `KIT_RUN_LIMITER`). Past it the index answers `429 rate_limited` with `Retry-After: 60` before anything is read or made, and the
  page says "You've started a lot of projects in the last minute. Wait a minute, then try again." Ten leaves room to
  retry a run that failed several times over; a tight loop makes at most forty items a minute. Remove What Was Made
  is not limited: it only deletes the person's own run.

## The apps' door

Each app (livediagram, liveplanner, livedocuments, livedesign, livehuddle) answers
`POST /api/internal/items/from-template` on its index key: `{ owner, folderId, name, template }` makes a new item for
`owner` (an account) in `folderId`, from `template` as its own `/new?template=` would start it, and answers its id.
It is the Drive import's path with the file built from the template: the index makes the item as the owner's (source
`template`), the item's object writes it, and a write that fails takes the index's item away again. An unknown
template is a 404 (`unknown_template`), so a catalogue that drifted fails loudly. The index alone calls it.

## Telemetry

A run is every app's at once, so its events are liveworkspace.app's own (`PLATFORM_TELEMETRY_APP`), sent by the kits
page with the Explorer's emitter and its consent rules, never in an app's name. Each carries the kit as its type
(`SoftwareProject`, `ProductLaunch`, `TeamWorkshop`, `WebsiteBuild`):

| Event           | When                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `Kit·Started`   | Create Project pressed                                                 |
| `Kit·Retried`   | Retry (or Try Again) pressed                                           |
| `Kit·Completed` | an answer, first or after a Retry, with every part and connection made |
| `Kit·Removed`   | Remove What Was Made confirmed and done                                |

A refused request (the network, a 429) sends nothing beyond its Started or Retried. The closed list is
`PLATFORM_OWN_TELEMETRY_EVENTS` (`packages/telemetry`), the only events the service takes in liveworkspace.app's own
name besides the Explorer's and the shared switches'. The dashboard's All apps view charts them as **Project Kits**
([008-telemetry](../008-telemetry/telemetry.md) "The dashboard").

## Security

- The person must be signed in, by their own token; the index refuses a guest (`403 sign_in_required`) and an app
  acting for a person (`403 forbidden`).
- Everything a run makes is the person's own: items in their own folder, passes on their own items. A retry or a
  removal names items, and the index acts only on items the person owns in the run's folder.
- The cross-app writes are the two narrow doors the index already has the right to: the template door (a new item,
  nothing else) and the connected tab's reverse write (one tab at the end of a tab bar). Both carry the app's own
  `INDEX_KEY`.
- The role defaults to Editor because the person chose it on the kit's screen, where it is named in words.
