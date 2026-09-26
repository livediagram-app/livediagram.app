# Collaborator enhancements

Status: shipped

Improvements to how you see and reach the other people in a diagram, centred
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
  a folder chip ([Tab folders](../006-diagram/tab-folders.md)). The "+N" popover that listed the
  hidden participants is gone: the modal lists everyone, so it replaces it.
- The modal lists **every person in the diagram, grouped by the tab they are
  on**, in tab-bar order. A tab nobody is on is left out. People on a tab that
  no longer exists (a peer's focus can briefly point at a tab just deleted) are
  grouped under **Another Tab** rather than dropped.
- Each group heading shows the tab's accent dot and name, **You're Here** on
  your current tab, and a **Go to Tab** button on every other tab. Going to a
  tab closes the modal.
- Each row shows the avatar, the name, badges (**You**, **Editor** / **Viewer**
  when the role is known, **Following** for the person you follow), and the
  status line: the presence word plus how long ago they were last active, the
  same text the avatar tooltip uses.
- **One person, one entry.** The room mints an id per connection, so the same
  browser open in two tabs used to show up twice (once as "You", once as a
  peer with your name). Every tab in a browser shares one collab key
  ([Per-participant responses](participant-responses.md)), so presence collapses on it: your
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
  when nobody else has joined yet.
- View-role visitors get the full modal: it mutates nothing, and following is
  already allowed for them ([Follow-me viewport](follow-me-viewport.md)).
- Available wherever the presence stack is, which is only a shared or team
  diagram (a private diagram has no stack, [Live app](../007-editor/live-app.md)). Hidden in embed mode, like
  the tab bar.
- **Also reachable by name from the search panel** ([Canvas and palette](../008-canvas/canvas-and-palette.md)),
  as the `collaborators` command. The presence stack is the discoverable entry
  point but it is easy to miss and, on a private diagram, absent — so the modal
  had exactly one door and no way in by typing. The command is in the
  **view-safe** set: it opens a panel and changes nothing, so a view-only
  visitor gets it too, and it is not gated on the diagram being shared or on
  anyone else being present — "Just you so far" is a real answer to "who is
  here", and the same subtitle already says it.

### Implementation notes

- `apps/live/lib/collaborator-roster.ts` builds the grouped roster from the
  same `participantsByTab` map the tab bar already renders, so the modal and
  the stacks cannot disagree about who is where.
- `CollaboratorsDialog` is its own dialog file on the shared `Dialog` shell;
  its open flag and the clicked participant id live in `useEditorDialogs`.
- Telemetry: `UI` / `Opened` / `Collaborators` on open. Following from the
  modal keeps the existing `Canvas` / `Used` / `FollowMe` event.
