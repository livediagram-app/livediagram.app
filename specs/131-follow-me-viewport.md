# 131 — Follow-me viewport

Status: **implemented**.

Pin your view to somebody else's: their pan, their zoom, their tab, until you
take the canvas back.

## Why

"Look at this" is the most common sentence spoken over a shared board, and the
board answers it worst. The tools that exist all point AT something from where
the speaker already is — the laser (spec/111), the spotlight (spec/112), a
walked-to avatar (spec/101) — and every one of them is useless to the person
who is scrolled somewhere else entirely. Presentation mode (spec/31) is still
draft and solves a different problem: an authored sequence, not a live one.

Following is the missing half: instead of moving the pointer to the audience,
move the audience to the pointer.

## Wire

A new **`viewport` RoomOp**: `{ kind: 'viewport', tabId, pan: {x, y}, zoom }`.

Ephemeral presence exactly like `cursor` / `laser` / `avatar`: throttled, never
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

## Starting and stopping

- **Start** from a peer's avatar in the presence stack: **Follow**. That stack
  is already where you go to find out who is here.
- While following, a pill reads **"Following Alex"** with a **Stop**.
- **Any canvas gesture of your own breaks it, instantly and silently** — pan,
  zoom, pinch, arrow keys, fit-to-screen, the minimap (spec/59). Grabbing the
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
  why. Two mirrors pointed at each other oscillate, and the check is cheap
  because the follow graph is one hop of local state.
- **Following someone who is following a third person just works**: you get
  their viewport, which is the third person's viewport. No special case.
- **Zoom is mirrored exactly, not fitted.** A follower on a smaller screen sees
  the same zoom level and therefore less of the canvas, centred on the same
  point. Re-fitting to show the same CONTENT would silently change the zoom the
  presenter is talking about ("see how small this is") and puts every follower
  on a different view of a feature whose entire promise is the same view.
