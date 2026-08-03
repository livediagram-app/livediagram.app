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

**The palette offers a tile per reaction**, collapsed behind a **Reactions**
accordion in Behaviour, the way Media does for embed providers (spec/121).
Which reaction you want is the whole decision — a pad is not useful until it is
the right one — so placing one and then going to change it is two steps for
something you already knew. The choice rides the draw intent
(`PendingDraw.reaction`) and lands on the element at commit, along with a
matching label ("Celebrate", "Thanks", "It shipped").

They are still ONE shape kind with a `reaction` field, not five kinds: the
element, its face, its burst and its menu are identical, and five kinds would
be five registrations to keep in step for a field that already exists.

It can still be switched afterwards from the element menu (**Tools ›
Reaction**), a tile grid rather than a dropdown: the five differ in _feeling_ rather than in name, so the glyph is
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

A **canvas and a particle system**, in `lib/reaction-particles.ts` (pure
physics) plus `ReactionBurst.tsx` (surface, clock, cleanup).

The first version was a dozen emoji spans on one CSS keyframe, and it could
not be made good. Every particle interpolated between the same two transforms,
so there was no velocity, no gravity, no drag, no tumble and no per-particle
life: the burst read as clip-art sliding across the screen. Spectacle needs a
hundred particles that **disagree with each other**, and a hundred DOM nodes
with per-particle keyframes is both slower and harder to read than one canvas
and a step function.

Particles carry position, velocity, rotation, spin, size, colour, gravity,
drag, a flutter phase and a life. Six drawn kinds — `ribbon`, `star`, `heart`,
`dot`, `ring`, `spark` — none of them emoji.

**Each reaction is a different physics**, which is what tells them apart at a
glance far better than the glyph did:

| Reaction      | Motion                                                               |
| ------------- | -------------------------------------------------------------------- |
| **Confetti**  | ~88 ribbons launched up in a fan, heavy gravity, tumbling            |
| **Sparkles**  | ~54 four-point glints, slow, high drag, twinkling alpha, faint rise  |
| **Hearts**    | 30 hearts, negative gravity, sway, staggered launch                  |
| **Applause**  | 3 expanding rings plus dots sprayed to both sides                    |
| **Fireworks** | 3 staggered shells of evenly-spaced sparks drawn as velocity streaks |

Details that carry more than their weight:

- **The ribbon tumble.** A confetti rectangle's width follows a cosine, so it
  turns edge-on and back like paper. Without it, confetti is falling blocks.
- **Sparks are streaks**, drawn along their own velocity vector. A round dot
  looks static however fast it is actually moving.
- **Additive blending** (`globalCompositeOperation = 'lighter'`), so
  overlapping particles build light instead of the topmost flatly covering the
  rest.
- **The hearts stagger.** Released together they left the pad as one clump and
  stayed one, because a slow rise gives them no time to separate. A launch
  delay spread over the first third of a second is what makes them a stream.
- **Even spacing in a firework shell**, with only slight jitter. Pure jitter
  looks like a sneeze; the ring is what makes a shell a shell.

### Frame-rate independence

Position is integrated with the **closed form** for linear drag plus constant
acceleration, not with `v += g·dt; x += v·dt`:

```
v(t) = vT + (v0 - vT)·e^(-k·t)        vT = g/k
x(t) = x0 + vT·t + (v0 - vT)·(1 - e^(-k·t))/k
```

Euler's velocity is already frame-rate independent (the decay is exponential
either way) but its **position is not**: the same 0.2s in one step and in
twenty landed 3px apart, so a 120Hz screen and a 60Hz screen drew measurably
different bursts. A test pins this, and it is the reason the integrator looks
heavier than it needs to.

### Cost

The canvas is `OVERSCAN` = 2 pad-widths larger per side (5x the pad in each
dimension), because the burst is supposed to leave the element — confetti that
stopped at the pad's edge would be a rectangle of paper. The backing store is
capped at 2x DPR: a 3x phone painting a hundred sparks gains nothing anybody
can see and costs fill rate every frame. The whole surface unmounts when the
last particle dies.

`dt` is clamped to 50ms, so a backgrounded tab resuming with a huge delta does
not teleport the burst to its end state in one step.

Under `prefers-reduced-motion` the engine steps once to 0.45s, paints that
single frame and stops. The reaction is celebration rather than information, so
somebody who asked for less motion loses nothing by getting a picture of it.

## Not votable

Like every Behaviour element (spec/39): a dot vote turns a press into a dot,
and a pad that is both "set this off" and "put a dot here" would mean whichever
one a running vote happened to make it. Controls, not candidates.
