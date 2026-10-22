# Bring Focus

Status: shipped

## What

A **Bring Focus** element: press it and everyone else in the room is offered a
jump to it, on your tab, at their own zoom.

It lives in the palette's **Behaviours → Navigate** group, beside Portal, Chair
and Link card. All four take somebody somewhere; this is the one that takes
everybody.

## Why

On a big canvas, "look at the thing in the bottom right" is a sentence that does
not work. Every tool for it points AT something from where the speaker already
is: the laser ([Laser Panel](../008-canvas/laser-panel.md)), the spotlight
([Spotlight Panel](../008-canvas/spotlight-panel.md)), a walked-to avatar
([Avatar mode](../008-canvas/avatar-mode.md)). Follow Me ([Follow-me viewport](follow-me-viewport.md))
solved the other half by moving one person to another, but it is a PULL: the
audience has to know to follow, and it pins them for as long as they stay
pinned.

Bring Focus is the push, and the one-off: I am the one who knows where to look,
I say so once, and everybody's view is their own again immediately.

## The invitation, not the yank

Pressing it **moves nobody**. Every other participant gets a dialog, because it is a question addressed to them
and the answer decides where they look next:

> **Alex wants you to look at something** [ Not now ] [ Take me there ]

Nothing happens until they take it.

This is the one place this element parts company with Follow Me, which is
explicitly unilateral ("being in the room is the consent"). The difference is
push versus pull: a follower chose to be moved and can stop whenever, whereas a
yank arrives unasked, in the middle of whatever they were doing. A canvas where
anybody can teleport everybody is a canvas where somebody's half-typed note gets
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
  showing that point in its middle (or, on a page, that page framed: see
  "On a page"), the invitation never appears. A press
  gets repeated (to catch a latecomer, or because half the room said no the
  first time), and a repeat has to reach the people who declined without
  putting a dialog over the people who came. Their view is the difference
  between the two, so it decides: the point within a tenth of the viewport of
  the middle counts as already there, at any zoom. Someone who took it and
  then panned away is offered it again, which is right, because they are no
  longer looking at it.

## Where it takes you

The op carries the element's **centre in canvas coordinates**, not the
presser's pan. Two people rarely have the same window size, so copying a pan
lands the element off-centre (or off-screen) for anyone whose canvas is a
different shape. Taking it **pans** your view so that point sits in the middle,
and **leaves your zoom as it was**: the presser's zoom on a phone or a wide
monitor shows a different amount of canvas than it did for them, and the zoom
you chose for your own screen is yours.

The op still carries the presser's `zoom` (the wire is unchanged, so clients
from before this rule keep working); a receiver ignores it.

If the element is on another tab, **taking it switches you there first**, through the
same tab-switch Follow Me uses. You have no zoom of your own for that canvas yet,
and the one fitted to the tab you left can be far too far in or out for this one
(a huge board fitted at 8% leaves a small diagram unreadable), so the tab enters
as any tab does, fitted to its content, and the point is then centred at that
fitted zoom.

### On a page

On a tab in Pages mode ([Pages](../007-editor/pages-mode.md)) the thing worth looking
at is a page, not a point: a slide, a poster, a page of an article. So when the element sits on a page,
taking the invitation **frames that page**, whole, beside the Contents sidebar, exactly as pressing the
page's label frames it (the same glide, the same fit), on this tab or after switching to it. Here the zoom
does change, because seeing the page is the point and the zoom that frames it is worked out on each
person's own screen, so it is still nobody else's zoom.

The page is worked out at each end from the shared document (the page the point is on, while the tab is
in a mode that shows pages), so the wire is unchanged. A Bring Focus on the surround between pages, or on
a tab in any other mode, centres the point as above.

"Already there" follows the landing: for a press on a page, somebody counts as already there when the
middle of their view is on that page and all of the page is on their screen, at any zoom that shows it
whole. Somebody zoomed into one corner of it is asked, because taking it would show them the page. The
presser's three sentences use the same rule.

## Wire

A new presence RoomOp, ephemeral exactly like `cursor` / `laser` / `viewport`:

```ts
{ kind: 'focus-here', tabId: string, at: { x: number; y: number }, zoom: number }
```

Never logged, never ordered (no `seq`), never replayed to a reconnecting client.
A "look at this" that arrives after the moment has passed is noise, so a late
joiner is not told about one, and it reaches D1 and undo
precisely never.

It carries **no sender name**: the room envelope already identifies the sender,
and the receiver resolves the name from the presence list it already has, so a
renamed participant's invitation reads correctly.

## Rules

- **Any Editor can press it; a Participant or a Viewer cannot.** Moving
  everyone's view runs the session ([Share roles](../013-workspace/share-roles.md),
  decided 2026-10-10), and the room drops a `focus-here` from anyone below Editor.
  Among Editors, the person who spots the thing worth looking at is often not the
  owner. The one exception arrived with the facilitator baton
  ([Facilitator](facilitator.md)): while somebody is running the session it is
  theirs to press, because "everybody look here" is the same act as "everybody
  stop and listen". With nobody facilitating — which is every session until
  somebody takes the baton — this rule is unchanged.
- **The presser is told what the press did**, rather than watching a button do
  nothing visible. Three sentences, because there are three outcomes: "Asked
  everyone else to look here", "Everyone else is already looking at it" (every
  peer whose view we know is on that tab with that point in its middle, judged
  on their own canvas size, which their `viewport` op carries),
  and "Nobody else is on this canvas right now" when the room is empty.
  Already looking at it ignores zoom, for the same reason taking it does. Saying
  the last one to a presser looking at a row of avatars reads as the feature
  being broken, which is why the middle one exists. A peer who has published no
  viewport, or one without a size (a client from before it was sent), counts
  as asked, not as already there: unknown is not the same as
  present, and erring that way is the harmless direction.
- **You never invite yourself.** The presser's own view does not move; they are
  already looking at it.

## The element

`shape: 'focus-button'`, default 120×96, in the Behaviour family with the mode
button and the session button. Its face is a target glyph over its label, which
defaults to "Bring Focus" and is edited like any label, so a canvas can have
"Start here" and "The problem" rather than four identical buttons.

Surfaces that cannot ask anyone to look (the export, the minimap) render the
face inert rather than hiding it; a Participant or Viewer session sees the face
without its press (see Rules). In an export that means the chip, the target and the label, drawn by
`svgBehaviourFace` from the same 24-unit reticle the canvas uses, so a picture
of the canvas shows the button rather than an empty box with a word in it
([Export fidelity](../020-import-export/export-fidelity.md)). The press states are the one thing left
out, for the reason every other control's are: nothing in a still image can be
hovered or held.

It is the one Behaviour element with **no `…` on its face**. The rest of the
family carries the shared settings ellipsis (or draws a richer one of its own),
because they hold something you set: a timer's length, a vote's dots. This
one holds nothing but a label and its colours, and those are reached by
right-clicking the element like any other shape, so the `…` would only open the
menu that was already one click away.
