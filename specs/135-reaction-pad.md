# 135 — The Reaction Pad

A **Behaviour** element (spec/103 to spec/107's family). Press it, or walk an
Avatar-mode character onto it, and a burst of reaction plays over the pad for
everyone in the room.

## The five reactions

Chosen to cover distinct **things people mean**, not five ways of saying
"nice". A sixth would be decoration.

| Reaction      | Glyph | For                               |
| ------------- | ----- | --------------------------------- |
| **Confetti**  | 🎉    | A result worth celebrating        |
| **Sparkles**  | ✨    | A good idea, nicely done          |
| **Hearts**    | 💜    | Warmth for a person, not a result |
| **Applause**  | 👏    | Thanks for the talk or the demo   |
| **Fireworks** | 🎆    | It shipped                        |

Switched from the element menu (**Tools › Reaction**), a tile grid rather than
a dropdown: the five differ in _feeling_ rather than in name, so the glyph is
the thing being chosen and a list of five words hides exactly the part the user
is picking on. The hint line under the grid says what the current one is for,
because "confetti or fireworks?" is a real question and both answers look like
celebration.

## Two triggers, one act

- **Press it.** A real `<button>`, so the click travels rather than only
  selecting, with `pointer-events: auto` so it works inside the pointer-inert
  Avatar / Spotlight / Isometric layers, and pointer-down left alone so
  dragging still moves the element. Same rules as the mode button and portal.
- **Walk onto it** in Avatar mode. Rides the SAME arrival hook the portal
  (spec/104) and the chair (spec/130) use, so a pad costs no third mechanism.
  Fires on **arrival**, so standing on a pad throws one burst rather than one
  per frame; stepping off and back on is a deliberate second press.

The pad is drawn as a floor pad, not a button — large centred glyph, label
beneath — because a thing you can stand on has to look like a thing you can
stand on.

## The burst is not state

Nothing about a burst is stored. It is not in the document, not undoable, and
not replayed to somebody who joins after it finished. The `reaction` room op
sits in the never-logged set beside `cursor` / `laser` / `avatar`: a burst you
missed is a burst that is over.

It is **local-first** — the presser's own machine plays it immediately and then
tells the room, rather than round-tripping through the server. A press has to
feel instant, and a burst is not shared state that could disagree; it is the
same animation run independently on every machine.

The op carries the **pad's element id**, not coordinates. The burst is drawn
around the element, and the element is where everyone already agrees it is;
sending x/y would mean a peer who has since moved the pad draws confetti over
empty canvas. It also carries the reaction, so a peer plays the right one even
if the pad's field changed under them mid-flight. An unrecognised reaction name
(a peer on a newer build) falls back to confetti rather than playing nothing —
the point of the press was that something visible happened.

Bursts are keyed by **element id**, so a pad can only be mid-burst once.
Hammering a pad restarts its burst rather than stacking twelve into a smear,
which is both what it looks like it should do and what stops somebody leaning
on the button from putting two hundred spans on the canvas.

## Drawing it

Plain absolutely-positioned spans on one CSS keyframe, not a canvas: a burst
lasts 1.5s and has a dozen particles, so a second rendering surface — with its
own resize, DPI and z-order problems, over a canvas that already carries an
isometric 3D transform — would cost far more than it saves.

The **shape of the motion** is most of what distinguishes the reactions at a
glance, so it lives in the numbers rather than in five near-identical
animations: confetti goes up and out then falls past the bottom; sparkles
twinkle tight to the pad; hearts float straight up, narrow and slow; applause
arcs wide to both sides; fireworks burst evenly in every direction.

Two things worth not re-deriving:

- Offsets are in **container units** (`cqw` / `cqh`), not percentages. A
  percentage inside `translate()` resolves against the element being
  transformed — the ~27px particle — so an offset of "3 pad-widths" moved it
  81px and the whole burst stayed huddled on the pad.
- The burst span therefore sets `container-type: size`, not Tailwind's
  `@container` (which is `inline-size` only), because the offsets are in
  element heights as well as widths.

Under `prefers-reduced-motion` the burst is a brief static puff. It is
celebration, not information, so somebody who has asked for less motion loses
nothing.

## Not votable

Like every Behaviour element (spec/39): a dot vote turns a press into a dot,
and a pad that is both "set this off" and "put a dot here" would mean whichever
one a running vote happened to make it. Controls, not candidates.
