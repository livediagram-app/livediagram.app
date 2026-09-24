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
- **Take me there is a one-off.** It lands you there and your view is yours
  again: no pinning, no invitation left on screen afterwards, no gesture needed
  to break out. If you want to stay on somebody's shoulder, that is Follow Me
  and it already exists.
- **Nobody already there is asked.** If your view is already on that tab,
  showing that point at about that zoom, the invitation never appears. A press
  gets repeated (to catch a latecomer, or because half the room said no the
  first time), and a repeat has to reach the people who declined without
  putting a dialog over the people who came. Their view is the difference
  between the two, so it decides: within 5% of the zoom, and within a tenth of
  the viewport of the point, counts as already there. Someone who took it and
  then panned away is offered it again, which is right, because they are no
  longer looking at it.

## Where it takes you

The op carries the element's **centre in canvas coordinates** and the presser's
**zoom**, not the presser's pan. Two people rarely have the same window size, so
copying a pan lands the element off-centre (or off-screen) for anyone whose
canvas is a different shape. Centring the point is the correct translation of
"come and look at this", and the zoom is what makes their view show the same
amount of board as the presser's.

If the element is on another tab, **taking it switches you there first**, through the
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
  owner. The one exception arrived with the facilitator baton
  ([spec/148](148-facilitator.md)): while somebody is running the session it is
  theirs to press, because "everybody look here" is the same act as "everybody
  stop and listen". With nobody facilitating — which is every session until
  somebody takes the baton — this rule is unchanged.
- **The presser is told what the press did**, rather than watching a button do
  nothing visible. Three sentences, because there are three outcomes: "Asked
  everyone else to look here", "Everyone else is already looking at it" (every
  peer whose view we know is on that tab, on that point, at about that zoom),
  and "Nobody else is on this board right now" when the room is empty. Saying
  the last one to a presser looking at a row of avatars reads as the feature
  being broken, which is why the middle one exists. A peer who has published no
  viewport counts as asked, not as already there: unknown is not the same as
  present, and erring that way is the harmless direction.
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
offering. In an export that means the chip, the target and the label, drawn by
`svgBehaviourFace` from the same 24-unit reticle the canvas uses, so a picture
of the board shows the button rather than an empty box with a word in it
([spec/143](143-export-fidelity.md)). The press states are the one thing left
out, for the reason every other control's are: nothing in a still image can be
hovered or held.

It is the one Behaviour element with **no `…` on its face**. The rest of the
family carries the shared settings ellipsis (or draws a richer one of its own),
because they hold something you set: a timer's length, a poll's question. This
one holds nothing but a label and its colours, and those are reached by
right-clicking the element like any other shape, so the `…` would only open the
menu that was already one click away.
