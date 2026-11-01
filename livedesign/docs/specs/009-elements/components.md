# Components

## What

A **component** is a piece of a design made once and used on many screens: a nav bar, a tab bar, a footer. Select
elements and **Make Component**: they become the component's **main**, kept in the design's **component library**,
and the selection is replaced by an **instance** of it. Instances are placed on any page of any tab of the design,
and editing the main redraws every instance, on every tab and for every collaborator, live.

- **Main** (`DesignComponent`): a name, a **frame** (`width` x `height`, set when it is made) and the elements it is
  made of, in the frame's own space (its top-left is `0, 0`). Mains live in the design's component library, never on
  a tab.
- **Instance**: ONE element, `shape: 'instance'` holding `componentId`, that draws its main inside its box. Its
  overrides are fields on it (`componentOverrides`). It is an ordinary shape in every other way.
- **Component library**: the design's mains, by id. Shown in the palette's **Components** category as the
  **In This Design** band, on every tab.

## Why

A nav bar or tab bar repeats on every screen. Without components, ten screens means editing the same header ten
times, and the copies drift.

## Why this is not a group again

Groups were removed ([Web components are elements; groups are gone](web-components-and-no-groups.md)) because every
selection, drag, delete, duplicate, lock, layer, quick-connect and clipboard path needed a group branch. A component
brings none of that back:

- **An instance is one element.** It is selected, dragged, resized, rotated, locked, layered, copied, deleted, linked
  and commented on exactly as any shape is, through the same paths, with no member list. Nothing on a tab refers to
  "the elements of a component"; the elements live in the main, off the tab.
- **The main is not on a tab** (the library is the design's), so there is no fan-out write: changing a main is one
  write, and every instance reads it when it draws. A tab shared by a scoped link, or into another design, still gets
  the mains its instances use (see Sharing).
- **There is no drill-in.** An instance's text, colours and icons are changed through its menu (Overrides), never by
  clicking into it. Editing the main itself is an **edit session** (below): the main's elements are put on the tab as
  plain elements, edited with the ordinary tools, and folded back into the instance when done. During it they are
  plain elements; no path branches on them.

## Making a component

**Make Component** (`⌥⌘K`, the selection's context menu, the multi-selection menu and the command palette) is offered
to an Editor when one or more unlocked elements are selected and every one may go into a component.

- **What may go in**: shapes (every kind but `instance` and `tab-window`), text, stickies, tables, drawings, paths,
  annotations and arrows. **Not** images, videos and embeds, link cards, or tab windows: their content lives outside
  the tab (the image store, a third party, another tab) and a main does not carry it in this version. With any of them
  selected, Make Component is shown disabled with "Images, videos, embeds, link cards and tab windows can't go in a
  component yet."
- **An instance in the selection** is detached first: its elements join the new main as plain elements (no nesting).
- **The frame** is the selection's bounding box. Each element keeps its id inside the main, its position moved into
  the frame's space.
- **The instance** takes the selection's place: its box is the frame, it sits in the stack where the lowest selected
  element was, on that element's layer, and it is selected.
- **Arrows**: an arrow inside the selection pinned to an element outside it keeps that end as a free point where it
  was. An arrow outside the selection pinned to an element inside it is re-pinned to the instance, same anchor.
- **Name**: `Component <n>`, `n` one more than the library's count, unique in the library.
- One undo step takes the tab back; the main stays in the library (Remove from Library takes it out of the band).

## How an instance draws

`resolveInstance(instance, main)` places the main's elements in the instance's box:

- Each element's position and size scale by `instance.width / main.width` and `instance.height / main.height`;
  text, stroke widths and icons keep their size (as when several boxes are resized together). Arrow points and bends
  scale the same way. Elements the main holds outside its frame draw outside the box, unclipped.
- Each is drawn as that element kind draws (the export renderer), in the instance's layer, under the instance's
  opacity, rotated with the instance about its centre.
- Overrides are applied before drawing (below).
- **Ids** inside an instance are `<instanceId>/<elementId>`, so two instances never share an element id.
- A main that is gone, or not yet loaded, draws as a dashed frame reading "Missing component" or "Loading component…".
- Resolving every instance on a tab is linear in the tab's elements plus the elements of the mains it shows.

## Overrides

An instance changes the main's **text**, **colours** and **icon** without detaching, per main element:

```ts
type ComponentOverride = {
  label?: string; // the element's text
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  iconId?: string; // swaps the element's icon, only where it has one
};
// on the instance: componentOverrides?: Record<mainElementId, ComponentOverride>
```

- An override **wins over the main**: a main change to an overridden field does not reach that instance; a main
  change to any other field does. So overrides survive a main change.
- An override for an element the main no longer has is ignored (and kept, harmlessly, until Reset Overrides).
- A cleared override (the reset arrow beside it) falls back to the main.
- **The Overrides section** of an instance's menu lists the main's elements that take one, in the main's order: a text
  field for each with text (its placeholder is the main's text), a colour well for its fill, stroke or text colour
  (the shared colour picker), and an icon swap (the icon picker) for one with an icon. **Reset Overrides** clears
  them all, one undo step.

## Editing the main: the edit session

**Edit Component** (an instance's menu, and double-click on an instance) starts an **edit session** on that instance:

1. The instance stays on the tab, hidden (`componentEditBy` set to the session's person), so arrows pinned to it,
   its comments and its links stay.
2. The main's elements are put on the tab as plain elements at the instance's place and scale, each marked
   `componentMember: { instanceId, elementId }`. The instance's overrides do not apply to them: this is the main.
3. They are edited with every ordinary tool: move, restyle, retype, delete, draw new ones. An element added on that
   tab during the session joins it (it is marked as it lands). One edit, one undo step, as always.
4. **Live**: after each change the main is derived from the members (positions back into the frame's space, at the
   instance's scale) and saved, so every other instance redraws as the members change. Only the session's person
   derives, so peers do not write the same main twice.
5. **Done** (the session bar, Escape with nothing selected, or Edit Component on another instance) derives the main a
   last time, removes the members and shows the instance again. Its box and frame are unchanged.

The session bar sits at the top of the canvas: "Editing <name>. Changes reach every instance." with **Done**. Anyone
who may edit sees it and may press Done (a session left open by someone who has gone).

- **The frame stays as it was made.** Members moved beyond it draw beyond every instance's box. A session never
  rescales other instances.
- Deleting every member ends the session and deletes the instance; the main keeps its last state.
- Undo through a session moves the members back, and the main follows them. Undo past its start removes the members
  and shows the instance again.
- A session is data on the tab, so it survives a reload and reaches peers. Exports during a session draw the members
  (the instance is hidden).

## Detach

**Detach** (an instance's menu, `⌥⌘B`) replaces the instance with plain elements: the main as this instance draws
it, overrides applied, in the instance's place, scale, rotation and layer, with fresh ids, selected. Arrows pinned to
the instance keep their end as a free point where it was. One undo step. Detaching never changes the main.

## The library

- **In This Design** is the first band of the palette's Components category, on every tab: a tile per main, its
  picture and name, newest first. Pressing a tile drops an instance at the viewport's centre at the frame's size.
  With no mains the band reads "Select elements and choose Make Component to reuse them across screens." (an Editor)
  and is hidden for anyone else.
- **Rename Component** (an instance's Component section): a name of up to 60 characters, collapsed whitespace, like a
  tab name.
- **Remove from Library** (same section) takes the main out of the band (`archived: true`). Instances already placed
  keep drawing it and can still be detached; it cannot be placed again. It is not deleted, since an instance on a tab
  not loaded may still use it.
- Rename and Remove from Library are library changes, not tab edits, so undo does not take them back.

## Sharing, collaboration and storage

- **Storage**: one row per main in the design's own store (`components` table, [API app](../015-api/api.md)), next to
  its tabs, with `component_refs (tab_id, component_id)` kept from every tab write in the same transaction (as
  `image_refs` is), so a reader knows which mains a tab uses without reading bodies.
- **Reads**: `GET /api/designs/:id/components` returns the mains a session may see: every main for a design-wide
  session; for a tab-scoped share link only the mains its tab uses (`component_refs`), so a scoped visitor never sees
  another tab's content, and an instance on their tab still draws. Archived mains are returned (instances need them);
  the palette hides them.
- **Writes**: `PUT /api/designs/:id/components/:componentId` (make), `PATCH` (change: a patch of named elements
  upserted and removed, name, archived), validated like tab elements. Edit role only (a scoped Editor too). A patch
  merges per element against the stored main, so two people changing different elements of one main both keep their
  change.
- **Realtime**: the worker, not the writer, announces each stored change as a `component` system op carrying the
  whole main and the tabs that use it; a tab-scoped session receives it only for mains its tab uses. Every editor
  applies it to its library, and every instance redraws. Instance elements merge per element, like any element.
- **An instance whose main is unknown** (placed by a peer a moment ago, or pasted) makes the editor read the library
  again, once at a time.
- **A tab shared into another design** ([Tab ↔ design many-to-many](../006-design/tab-design-many-to-many.md)) carries
  the mains its instances use, with every body it sends; the design taking it in keeps each as its own main under the
  same id, the later `updatedAt` winning. After that each design's library is its own.
- **A copy of a design** copies its library. **A This Browser design** keeps its library in the browser with its tabs.
- **Clipboard**: copied instances carry their mains; a paste into a design without one adds it to that library.

## Exports, thumbnails and agents

- **Every export** (PNG, SVG, PDF, the logo kit, page exports, layout thumbnails, tab windows showing a tab) expands
  each instance into its resolved elements before drawing (`expandInstances`), so an instance exports exactly as the
  same elements would. An instance itself draws nothing in an export; it stays only as the box arrows pin to.
- **Thumbnails and the API's tab render** expand with the library read from the design's store.
- **Agents** ([Agents](../024-agents/README.md)): the views list an instance as `instance of "<name>"` with its
  overrides, and the `components` view lists the library (each main's id, name, frame and elements). Agents place an
  instance as an element (`shape: 'instance'`, `componentId`), change its `componentOverrides`, make a component from
  element ids, detach an instance, and patch a main.

## Share roles

| Role        | May                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------- |
| Editor      | Make, place, override, detach, edit, rename and remove components                        |
| Participant | See instances; may not make, place, override, detach or edit them, or change the library |
| Viewer      | See instances                                                                            |

Gated on the session's `can.edit`, never on read-only alone. The api refuses component writes from a Participant or
Viewer, and a Participant's element op adding or changing an instance.

## Limits

- `MAX_COMPONENT_ELEMENTS` (200) elements per main; `MAX_COMPONENTS` (200) mains per design; a main's JSON is capped
  at `MAX_COMPONENT_BYTES` (256 KB). A Make Component over a cap is refused with a toast naming it.
- A component name is 1 to 60 characters.
- At most `MAX_COMPONENT_OVERRIDES` (200) overrides per instance; an override's text is bounded as a label.

## Telemetry

`Element · Added · Component` on Make Component; `Element · Added · Instance` on placing one; `Element · Changed ·
ComponentOverride`, `Element · Changed · ComponentDetach`, `Element · Changed · ComponentEdit` (a session's Done).
Never a name.

## Non-goals

- Nested components (a main holding an instance), variants, and component properties beyond text, colours and icon.
- Images, videos, embeds, link cards and tab windows inside a main.
- Resizing a main's frame after it is made, and constraints (pinning a child to an edge as an instance resizes).
- Sharing a library between designs (a tab shared in carries copies).
