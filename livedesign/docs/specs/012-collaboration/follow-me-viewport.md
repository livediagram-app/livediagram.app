# Follow-me viewport

Status: **implemented**.

Pin your view to somebody else's: their pan, their zoom, their tab, until you
take the canvas back.

## Why

"Look at this" is the most common sentence spoken over a shared canvas, and the
canvas answers it worst. The tools that exist all point AT something from where
the speaker already is — the laser ([Laser Panel](../008-canvas/laser-panel.md)), the spotlight ([Spotlight Panel](../008-canvas/spotlight-panel.md)) — and every one of them is useless to the person
who is scrolled somewhere else entirely.

Following is the missing half: instead of moving the pointer to the audience,
move the audience to the pointer.

## Wire

A new **`viewport` RoomOp**: `{ kind: 'viewport', tabId, pan: {x, y}, zoom, size?: {width, height} }`. `size` is the sender's canvas; Follow Me does not use it.

Ephemeral presence exactly like `cursor` / `laser`: throttled, never
logged, never ordered (no `seq`), never replayed to a reconnecting client.

- **Sent on change only**, throttled to ~10 Hz. A camera is not a pointer;
  10 Hz is smooth for a pan and a third of the traffic of the cursor stream, and
  an idle participant sends nothing at all.
- **Sent by everyone, not on request.** The alternative — a follower asks, the
  presenter starts publishing — needs a second op kind, a re-request on every
  reconnect, and a rule for what happens when the presenter reloads mid-follow.
  For three numbers on an already-throttled channel, the handshake costs more
  than the traffic it saves. The cost is real and accepted: a room where nobody
  follows anybody still carries viewport frames while people scroll.

## Who follows whom

The room keeps the follow graph, because a client never learns its own presence
id (the room mints one per socket and tells nobody which is theirs), so it cannot
recognise itself in a peer's message.

- A client sends **`{ kind: 'follow', target }`** whenever who it follows changes:
  the presence id it now follows, or `null` when it stops. It is presence (any
  role may send it, a tab-scoped visitor too) but the room **never relays it**:
  it keeps the target on the session's attachment.
- Each time a session's follow changes, and when a follower's socket closes, the
  room sends the person followed **`{ kind: 'followers', ids }`** on their socket
  alone: the presence ids following them, sorted. Nobody else hears it.
- A new socket is a new presence id: the client empties its followers list when
  a socket opens and says its own follow again right after `hello`.
- The presenter's own avatar in the tab presence stack carries the count, and its
  hover card names it ("2 Following You").

## Starting and stopping

- **Start** from the Collaborators modal ([Collaborator enhancements](collaborator-enhancements.md)):
  click any avatar in a tab's presence stack, then **Follow** on that person's
  row. The stack is where you go to find out who is here; the modal is where
  you act on it. (Clicking the avatar used to start following directly.)
- **You land on their view at once.** Viewports go out on change only, so the person followed publishes theirs
  again whenever the set of people following them changes (`useShowFollowersMyView`): one frame per follow. Without
  it, a follower who joined after the presenter's last pan read "Following Alex" over a view of their own until
  Alex next moved.
- While following, a pill reads **"Following Alex"** with a **Stop**.
- **Any canvas gesture of your own breaks it, instantly and silently** — pan,
  zoom, pinch, arrow keys, fit-to-screen, the minimap ([Minimap](../008-canvas/minimap.md)). Grabbing the
  canvas IS the statement that you want your own view back, and a follow that
  survives it would be a fight the user cannot win. No confirmation, no toast:
  it ends the moment you move, and the pill going away says so.
- Following also **follows their tab**: the presenter's existing `tab-focus` op
  switches you with them, so "look at this" works when the this is on tab 3.
- A follow ends by itself when the person you're following **leaves the room**,
  with a one-line notice so the sudden freedom is explained.

## Rules

- **View-role visitors can follow, and can be followed.** It mutates nothing —
  it's the purest possible read-only feature, and the audience on a view link
  is exactly who most needs it.
- **It is unilateral and needs no consent.** Being in the room is the consent;
  a request/approve flow is friction in the precise moment the feature exists
  to serve. The presenter sees a small count on their own presence chip
  ("2 following") so they know to narrate rather than mouse in silence.
- **Following someone who is following you is refused**, with a line saying
  why ("Alex is following you, so you can't follow them back."). Two mirrors
  pointed at each other oscillate. The check reads the room's `followers` list
  (below), one hop, so it costs nothing. Two people who press Follow on each
  other at the same moment both pass that check before the list arrives, so a
  follow also ends, with the same line, as soon as the list shows the person
  followed following you back.
- **Following someone who is following a third person just works**: you get
  their viewport, which is the third person's viewport. No special case.
- **Zoom is mirrored exactly, not fitted.** A follower on a smaller screen sees
  the same zoom level and therefore less of the canvas, centred on the same
  point. Re-fitting to show the same CONTENT would silently change the zoom the
  presenter is talking about ("see how small this is") and puts every follower
  on a different view of a feature whose entire promise is the same view.
