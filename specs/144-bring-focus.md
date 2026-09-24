# 144 — Bring Focus

Status: shipped

## What

A **Bring Focus** element: press it and everyone else in the room is offered a
jump to it, at your zoom, on your tab.

It lives in the palette's **Behaviours → Navigate** group, beside Portal, Chair
and Link card. All four take somebody somewhere; this is the one that takes
everybody.

## Why

On a big board, "look at the thing in the bottom right" is a sentence that does
not work. Every tool for it points AT something from where the speaker already
is: the laser ([spec/111](111-laser-panel.md)), the spotlight
([spec/112](112-spotlight-panel.md)), a walked-to avatar
([spec/101](101-avatar-mode.md)). Follow Me ([spec/131](131-follow-me-viewport.md))
solved the other half by moving one person to another, but it is a PULL: the
audience has to know to follow, and it pins them for as long as they stay
pinned.

Bring Focus is the push, and the one-off: I am the one who knows where to look,
I say so once, and everybody's view is their own again immediately.

## The invitation, not the yank

Pressing it **moves nobody**. Every other participant gets a dialog, the same
shape as the poll prompt (spec/119), because it is a question addressed to them
and the answer decides where they look next:

> **Alex wants you to look at something** [ Not now ] [ Take me there ]

Nothing happens until they take it.

This is the one place this element parts company with Follow Me, which is
explicitly unilateral ("being in the room is the consent"). The difference is
push versus pull: a follower chose to be moved and can stop whenever, whereas a
yank arrives unasked, in the middle of whatever they were doing. A board where
anybody can teleport everybody is a board where somebody's half-typed note gets
lost, and the cost of the extra click is one click.

- **One invitation at a time.** A second one replaces the first, because the
  room has one current "look at this" and an older one is stale by definition.
- **It expires after 60 seconds.** Long enough to look up from what you were
  doing, short enough that it is never answering a sentence from two topics ago.
- **Go is a one-off.** It lands you there and your view is yours again: no
  pinning, no invitation left on screen afterwards, no gesture needed to break out. If you
  want to stay on somebody's shoulder, that is Follow Me and it already exists.

## Where it takes you

The op carries the element's **centre in canvas coordinates** and the presser's
**zoom**, not the presser's pan. Two people rarely have the same window size, so
copying a pan lands the element off-centre (or off-screen) for anyone whose
canvas is a different shape. Centring the point is the correct translation of
"come and look at this", and the zoom is what makes their view show the same
amount of board as the presser's.

If the element is on another tab, **Go switches you to it first**, through the
same tab-switch Follow Me uses.

## Wire

A new presence RoomOp, ephemeral exactly like `cursor` / `laser` / `viewport`:

```ts
{ kind: 'focus-here', tabId: string, at: { x: number; y: number }, zoom: number }
```

Never logged, never ordered (no `seq`), never replayed to a reconnecting client.
A "look at this" that arrives after the moment has passed is noise, so a late
joiner is not told about one, and it reaches D1, the change log and undo
precisely never.

It carries **no sender name**: the room envelope already identifies the sender,
and the receiver resolves the name from the presence list it already has, so a
renamed participant's invitation reads correctly.

## Rules

- **Anyone in the room can press it, including view-role visitors.** It mutates
  nothing, which makes it the same read-only act as following somebody, and in a
  workshop the person who spots the thing worth looking at is often not the
  owner.
- **Nobody else in the room?** The presser is told so, rather than the press
  doing nothing visible. A button that looks broken when it is merely alone is
  worse than a sentence.
- **You never invite yourself.** The presser's own view does not move; they are
  already looking at it.
- It is **not** in the change log: nothing changed.

## The element

`shape: 'focus-button'`, default 120×96, in the Behaviour family with the mode
button and the session button. Its face is a target glyph over its label, which
defaults to "Bring Focus" and is edited like any label, so a board can have
"Start here" and "The problem" rather than four identical buttons.

Read-only surfaces (the export, the minimap, a view-only session) render the
face inert rather than hiding it: a viewer should still see what the board is
offering.
