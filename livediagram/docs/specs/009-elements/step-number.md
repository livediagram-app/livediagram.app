# The step number

## What

A **Step number**: a small disc carrying a number ("1", "2", "3a") for walking a reader through a diagram in order,
the way annotated architecture diagrams mark a request's path. A `shape: 'step'`.

## Why

A diagram that explains a sequence (a request path, an onboarding flow, an incident timeline) needs its order on
the canvas, not only in the arrows. Today that is a small circle and a text box, two elements to keep aligned and
renumber by hand.

## The element

- **The number is the label**, at most 3 characters, so "1", "12" and "3a" all fit. Double-click edits it.
- **A new step takes the next number**: one more than the highest whole number among the tab's steps, or 1 when there
  are none. It does not renumber itself afterwards: moving a step keeps its number, and deleting one leaves the
  others as they are, because a number that changes under you mid-edit is worse than a gap.
- **Renumber Steps** (in the step's menu, and in the command palette while the tab holds a step) renumbers every step on the tab 1, 2, 3… in
  **reading order**: top to bottom in rows, then left to right, where a row is any steps whose centres sit within
  half a step's height of each other. One history step.
- **Size**: a circle, 28px by default, aspect-locked; resizing grows the disc and its number together.
- **Look**: the badge's five looks ([The badge](badge.md)) on `chipLook`, **Ink** by default (the dark disc with a
  light number), so a step reads apart from an accent badge on the same node.

## Attaching

A step attaches to a host's eight points and follows it exactly as a badge does ([The badge](badge.md)
"Attachment"). A step not dropped on a point stands alone, which is the usual case on an arrow: it sits where you put
it. A step takes no connectors.

## Animation

A step takes the **Shape** set for its body, along its disc. It adds one option of its own:

- **Play in Order** (`stepSequence: true`), a toggle in the step's **Step Number** section, offered while the step has
  an animation.
  Each step whose label is a whole number `n` starts `(n − 1)` beats after step 1, a beat being 0.4 s at normal speed
  (scaled by the animation's Speed), so a pulse walks 1, 2, 3 and comes round again. Turning it on or off
  applies to every step on the tab (one history step), since order is a property of the set. It is CSS only: an
  `animation-delay` from the stored number, no script. A step whose label is not a whole number plays
  without a delay. Reduced motion and every export show the rest frame.

## Palette

| Mode     | Where                                   |
| -------- | --------------------------------------- |
| Diagram  | **Build**: Step Number                  |
| Workshop | none (Search still finds and places it) |

## Share roles

| Role        | May                                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| Editor      | Everything above                                                                      |
| Participant | Write a step's number, as on any element; cannot place, move, renumber or restyle one |
| Viewer      | Look                                                                                  |

## Agents

The MCP server and the REST API take `step`; an agent sets the number as the label.
