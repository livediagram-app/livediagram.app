# Collaborator enhancements

Status: shipped

Improvements to how you see and reach the other people in a design, centred
on the presence avatars in the tab bar and what they open. Each improvement is
its own numbered section, so later ones land here rather than in a new spec.

## 1. The Collaborators modal

### The problem

The presence stack on each tab ([Live app](../007-editor/live-app.md)) answers "who is on
_this_ tab", three avatars at a time, and nothing more. To learn where everyone
is you had to hover every tab in turn, and a folder's hidden members only showed
as a merged stack on the chip. Clicking an avatar did one thing, start following
that person ([Follow-me viewport](follow-me-viewport.md)), which is a surprising
result for a click whose obvious meaning is "tell me about this person".

### The behaviour

- **Clicking any avatar in a tab's presence stack opens the Collaborators
  modal**, including your own avatar, the "+N" overflow badge, and the stack on
  a folder chip ([Tab folders](../006-design/tab-folders.md)). The "+N" popover that listed the
  hidden participants is gone: the modal lists everyone, so it replaces it.
- The modal lists **every person in the design, grouped by the tab they are
  on**, in tab-bar order. A tab nobody is on is left out. People on a tab that
  no longer exists (a peer's focus can briefly point at a tab just deleted) are
  grouped under **Another Tab** rather than dropped.
- Each group heading shows the tab's accent dot and name, **You're Here** on
  your current tab, and a **Go to Tab** button on every other tab. Going to a
  tab closes the modal.
- Each row shows the avatar, the name, badges (**You**, **Editor** / **Viewer**
  when the role is known, **Following** for the person you follow), and the
  status line: the presence word plus how long ago they were last active, the
  same text the avatar hover card uses.
- **One person, one entry.** The room mints an id per connection, so the same
  browser open in two tabs would show up twice. Every tab in a browser shares one collab key
  (`participantKey`), so presence collapses on it: your
  own other tabs are left out, and a peer connected more than once appears
  once, on the tab of their most recently active connection. This applies to
  the tab-bar stacks too, since both read the same per-tab map. Two different
  browsers or devices have different keys, so they still show separately.
- Within a group: you first, then by status (online, away, offline), then by
  name.
- **Follow lives here now.** Every row but your own has a **Follow** button
  (**Stop Following** on the person you follow). Following starts exactly as it
  did from the avatar ([Follow-me viewport](follow-me-viewport.md): it follows their tab and viewport) and closes
  the modal so you can watch.
- The person whose avatar you clicked is highlighted and scrolled into view, so
  the click still reads as "tell me about _them_".
- The subtitle counts the room: "3 people across 2 tabs", or "Just you so far"
  when nobody else has joined yet. Each person counts once: someone with two tabs
  side by side is listed under both, and still counts as one person.
- View-role visitors get the full modal: it mutates nothing, and following is
  already allowed for them ([Follow-me viewport](follow-me-viewport.md)).
- Available wherever the presence stack is, which is only a shared or team
  design (a private design has no stack, [Live app](../007-editor/live-app.md)). Hidden in embed mode, like
  the tab bar.
- **Also reachable by name from the search panel** ([Canvas and palette](../008-canvas/canvas-and-palette.md)),
  as the `collaborators` command. The presence stack is the discoverable entry
  point but it is easy to miss and, on a private design, absent, so the modal
  had exactly one door and no way in by typing. The command is in the
  **view-safe** set: it opens a panel and changes nothing, so a view-only
  visitor gets it too, and it is not gated on the design being shared or on
  anyone else being present: "Just you so far" is a real answer to "who is
  here", and the same subtitle already says it.

### Implementation notes

- `apps/live/lib/collaborator-roster.ts` builds the grouped roster from the
  same `participantsByTab` map the tab bar already renders, so the modal and
  the stacks cannot disagree about who is where.
- `CollaboratorsDialog` is its own dialog file on the shared `Dialog` shell;
  its open flag and the clicked participant id live in `useEditorDialogs`.
- Telemetry: `UI` / `Opened` / `Collaborators` on open. Following from the
  modal keeps the existing `Canvas` / `Used` / `FollowMe` event.

## 2. Hide Participant Cursors

### The problem

In a busy session everyone's cursor and name pill move over the canvas at once. Nothing hid them, so one
person who just wants to read or work without the movement had no way to turn them off for themselves.

### The behaviour

- **One switch, Hide Participant Cursors**, off by default. On, this screen stops drawing other people's
  cursor arrows and name pills. Nothing else changes: avatars on the tabs, the Collaborators modal, Follow,
  selection discs and locks, laser trails and agents' focus rings all stay, and everyone else still sees your
  cursor.
- **Two places, one value.** The switch is in Settings under **Panels › Collaborate**, and the same switch sits
  at the foot of the Collaborators modal, one click away when a session gets busy. Flipping either flips both.
- **Remembered on this device**, in `localStorage` (`<product>:v2:hide-cursors`), never in the synced
  `UserPreferences` ([User preferences](../007-editor/user-preferences.md)): like the Keyboard Shortcuts switch,
  it suits a screen (a projector, a small laptop) rather than a person. Every tab of the browser follows a flip
  at once (the `storage` event). It is not on the Settings page at liveworkspace.app, which shows synced
  settings only.
- **A filter at render, nothing on the wire.** Peers' cursor positions still arrive; they are just not drawn.
  Turning it off shows every cursor again at its latest position.
- **Every role** (Editor, Participant, Viewer) has it: it only changes what this screen draws, and nobody
  else sees any difference.

### Implementation notes

- `@liveworkspace/workbench`: `hooks/collab/useHideCursors` (the store, over `useLocalStorageValue` and the
  `hideCursorsKey` binding), `components/canvas/RemoteCursor` (the cursor, and `RemoteCursors`, the layer that
  draws the list and draws nothing while the switch is on) and `components/dialogs/HideCursorsSwitch` (the
  modal's row). The editors' four copies of `RemoteCursor.tsx` are gone.
- Settings: a `hideCursors` row (its own kind, like `shortcuts`) in the Collaborate category.
- Telemetry: `UI` / `Toggled` / `HideCursorsOn` / `HideCursorsOff`, sent before the write, from either place.
