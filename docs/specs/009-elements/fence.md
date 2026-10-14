# Fence

A Behaviour element an Avatar-mode character **cannot walk through**.

## Why

[Avatar mode](../008-canvas/avatar-mode.md) lets a room walk around a canvas, and until now the canvas
had no edges: a character could stroll through the middle of a board someone was still writing on,
stand on a facilitator's agenda, or wander into the one area a session wanted to keep clear.

A fence gives the author a way to say "not in here" with the same tools they use to say anything
else on the canvas: place it, stretch it, turn it. Fences joined end to end make a barrier of any
shape, so fencing off a board means drawing four fences round it. People can still walk all the
way round the outside; they cannot come in.

## The element

A **shape kind**, `fence`, in the palette's **Collaborate** category under **Navigate**, beside
the portal, the bring focus button, the chair and the link card.

- **Drawn as a fence**: square posts at both ends and at even spacing between, with two rails
  running the full length. It reads as a barrier, not as a box with a border.
- **One straight run per element.** The run lies along the element's **longer side**: a wide fence
  runs across, a tall one runs down. Resizing a fence past square turns it, so a horizontal fence
  stretched tall becomes a vertical one; rotating it like any element points it any other way.
- **Joined fences read as one.** The end posts sit half the fence's thickness in from each end and
  the rails run to the very ends, so two fences placed end to end continue each other's rails,
  and two fences whose boxes share a corner put their end posts on the same spot. The ordinary
  snap guides line their edges up.
- **No label and no settings `…`.** A fence is scenery, like a chair; there is nothing to write on
  it and nothing to set beyond its colour.
- **Its colour is its stroke.** Unstyled it is a wood brown that reads on light and dark paper;
  the stroke colour picker recolours posts and rails together.
- Otherwise an ordinary element: move, resize, rotate, group, lock, copy, theme, export.
- **One drawing, on the canvas and in an export**: both draw from the shared fence geometry in
  `@livediagram/document`.

## Blocking

While a character walks (a click-walk, the arrow keys, or a shove from a peer), **it cannot cross a
fence**, from either side.

- The blocking line is the fence's run: the centre line along its longer side, from end to end,
  turned with the element's rotation.
- A character keeps a small **reach** (its feet's width) away from the line, so it stops at the
  fence rather than standing in it. Two fences whose ends are closer together than a character is
  wide leave no gap to squeeze through, so fences joined by hand need not meet exactly.
- **Walking into a fence slides along it.** A diagonal walk that meets a fence keeps the part of
  its movement that runs along the fence, so a character steered into a fence skims along it the
  way people walk along a wall. A click-walk that can make no progress stops where it is. Whether a
  walk slides or stops depends on its angle alone, never on the display's frame rate.
- **A character already inside a fence's reach** (a fence dropped on top of one) may step away
  from it, never across it; one standing exactly on the line may step off it to either side.
- **A hidden layer's fences block nothing**, as its portals and chairs do nothing: a character walks
  among what is drawn.
- **What does not walk is not blocked.** A portal still carries a character through a fence (a
  portal is a gate), sitting snaps a character onto its chair, and a new character appears where
  the mode puts it. A character that starts inside a fenced area stays inside until it takes a
  portal out.
- **A fence is not a destination.** Standing beside one does not ring it as "the element you are
  on".

## Who it blocks

Blocking is decided on each person's own machine for their own character, the same trust model as
the rest of [Avatar mode](../008-canvas/avatar-mode.md): everyone's character is authoritative on
its owner's machine. Nothing about blocking is written to the document or sent to the room; peers
simply never see a character on the far side of a fence because its owner's walk never got there.

## Share roles

- **Editor**: places, moves, resizes, turns, recolours and deletes fences, like any element.
- **Participant**: the participant palette does not offer the fence; a Participant's character is
  blocked like everyone's.
- **Viewer**: cannot change a fence; a Viewer's character is blocked like everyone's.

## Not in scope

- **No gates.** A fence has no opening; leave a gap between two fences, or put a portal in it.
- **No bent fences.** One element is one straight run; corners are two fences.
- **No blocking of the canvas tools.** A fence stops characters, never cursors, selection,
  dragging or arrows.
