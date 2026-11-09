# People arrows

Status: **implemented** (owner, 2026-11-09).

On a Space with a few people about, a small arrow in each person's colour sits at the edge of your screen and points
the way to anyone you cannot see, so you know which way to walk to reach them.

## Why

A Space is bigger than a screen. With the camera centred on your character ([The camera](avatar-mode.md#the-camera)),
everyone further away than half a screen is gone, and the only way to find them was the Map or wandering about. A
pointer at the edge says "they are over there" without opening anything.

## Domain language

| Term                 | Means                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **A people arrow**   | The marker at the canvas's edge for one person you cannot see                                          |
| **In view**          | Their character stands in the canvas area, clear of every control laid over it                         |
| **The rail**         | The line the arrows travel on: the canvas's edge, inset by the arrow's own size and a small gap        |
| **A control's rect** | The screen box of a control over the canvas (toolbar, Call dock, Map, zoom cluster, a panel), measured |

## Who gets an arrow

- **Humans on your tab.** Every other person whose character is on the tab you are looking at. An agent's row
  ([Agent presence](../024-agents/agent-presence.md)) never gets one, and the Receptionist is not a person in the room.
- **Only while it is a few.** The arrows show while there are **fewer than 10 other people** on your tab (1 to 9). At 10
  or more they all go: a ring of arrows round the screen says nothing. People on the tab who are not walking count
  towards the 10 but have no character to point at.
- **Only when they are out of view.** A person in view has no arrow; one hidden behind a control, or past the edge,
  has one. A small margin stops it flickering on the boundary: someone has to be **24 px inside** the clear canvas to
  count as in view, and has to cross back over the edge (or behind a control) to get their arrow back.
- **Desktop only.** Not on a phone (the phone breakpoint, `useIsMobileViewport`), where the canvas is small and the
  controls fill its edges.
- Whether or not you are walking yourself: someone else's character draws on your canvas in Edit too, and so does
  their arrow.

## What it looks like

- **A teardrop in their colour**: a round head with a point, in the person's presence colour (the colour of their
  shirt and name chip), a white outline and a soft shadow so it reads on grass, paths and dark floors. Their initials
  (the same two letters as their avatar chip, `initialsOf`) sit upright in the head; the point turns to face them.
- **It points at them, not just outwards.** The point aims from where the arrow sits to the person, so an arrow
  slid along the edge still points true.
- **Closer is bolder.** A person just past the edge gets a full-size, fully opaque arrow; one far away (1600 screen px
  or more beyond the edge) a slightly smaller, lighter one.
- **Hover** lifts it a touch with a soft glow in their colour and shows the app's tooltip with their name. **Press**
  sinks it a little.

## Where it sits

- **On the rail**: the arrow sits where the line from the canvas's centre to the person crosses the rail, so it moves
  along the edge as they, you or the view move.
- **Never over a control.** The rects of the controls over the canvas are measured from the page, not hard-coded: every
  element marked as a canvas obstacle (`data-canvas-obstacle`), every floating panel (`data-floating-panel`: the menu
  card, the toolbar strip, the banners, the Map, the Call dock), every region root laid over the canvas (`data-region`,
  the canvas itself aside: the zoom cluster), and any open non-modal dialog or menu, wherever it was portalled. A region
  holding marked controls is measured through them (the toolbar's region spans the canvas's width to centre the strip;
  only the strip and the menu card are in the way). A collapsed or moved panel, a narrow window or an open popover is
  measured as it is. When the arrow's spot falls behind one, it **slides along the edge to the nearest clear spot**
  beside that control, still pointing at the person (someone straight below the Call dock gets an arrow just left or
  right of the dock, pointing down and across). With the whole rail covered there is no arrow.
- **Never on top of each other.** Two people in about the same direction get arrows side by side along the edge (one
  arrow and a 4 px gap apart, the later one stepping on past any control), each pointing at its own person.

## Following along

- **It follows live.** Their steps, your walking (the camera moves with you), a pan, a zoom and a resize all move the
  arrow at once, along the edge, still pointing at them.
- **Motion.** The arrow glides along the edge and turns smoothly (eased each frame, the shorter way round), never
  snapping. It arrives by growing and fading in with a slight overshoot, and as the person comes into view it shrinks
  and fades away where it is. A slow, small nudge in the direction it points says "this way"; it is a little stronger
  for the first few seconds after someone arrives.
- **Reduced motion** (the OS setting or the app's Reduce Motion): no glide, no overshoot and no nudge. Each arrow is
  simply where it should be, and appears and disappears at once.

## Pressing an arrow

Pressing an arrow **glides the view to centre that person**, at the zoom you have (reduced motion: at once). It does
not walk you there: you choose whether to go. While you walk, the camera then comes back to you as you step
([The camera](avatar-mode.md#the-camera)).

## Accessibility

Each arrow is a button named `Show {name}`; the tooltip says their name. Arrows for people in view are hidden from the
accessibility tree and the tab order.

## Performance

- The arrows render once per change of **who** has one (a person arriving, leaving, renaming, recolouring, or the count
  crossing 10), never for a step, a pan or a zoom.
- One `requestAnimationFrame` loop moves every arrow, writing only `transform` and `opacity`. It runs while something
  moves (a step, a pan, a glide still settling) and stops once every arrow has settled. It is woken by the view store,
  the peers' character store and a resize.
- The controls' rects are measured at most every 250 ms while the loop runs, and every 500 ms while an arrow shows and
  the loop is idle (a panel opening over an arrow moves it), never while no arrow shows.
- The work is bounded by the cap: at most 9 arrows.
- Measured (dev build, desktop Chrome, two arrows, panning): a frame of the loop costs 0.1 ms at the median, 0.2 ms at
  p95, 0.9 ms at most; measuring the controls costs 0.12 ms. The geometry for 9 arrows past 12 controls stays inside a
  60 ms CPU budget for 1000 frames (`people-arrows-geometry.test.ts`).

## Where the code lives

- `apps/editor/components/canvas/people-arrows/people-arrows-geometry.ts`: the pure rules (who, in view, the rail, the
  slide past controls, the spread, the boldness), unit-tested.
- `people-arrows-motion.ts`: one arrow's easing per frame (glide, turn, grow, fade; reduced motion snaps).
- `people-arrows-engine.ts`: the frame loop: reads the view, the characters and the controls' rects, steps each arrow,
  writes its node.
- `PeopleArrows.tsx`: the layer and its buttons, mounted by the canvas beside its chrome.
