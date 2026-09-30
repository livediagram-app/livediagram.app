# The Reaction Pad: blueprint

Derived from [The Reaction Pad](../reaction-pad.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/document/src/data-shapes.ts`                   | `REACTIONS`, hues, labels, emoji, hints, pad labels, `isReaction` |
| `packages/document/src/shape-factory.ts`                 | 150x110, `reaction: REACTION_DEFAULT`, label "Celebrate"          |
| `packages/document/src/validate.ts`                      | Validates the `reaction` field [QF21]                             |
| `packages/document/src/session.ts`                       | `NON_VOTABLE_SHAPES` includes `reaction-pad`                      |
| `packages/document/src/svg-render-faces.ts`              | `reactionPad`: the export wash, spot, emoji and label chip        |
| `packages/api-schema/src/room-messages.ts`               | The `reaction` op; `'reaction'` in `PRESENCE_OP_KINDS`            |
| `apps/live/components/canvas/ReactionPadFace.tsx`        | The face: glow, emoji, spot, press ring, label pill; the press    |
| `apps/live/app/qa-board.css`                             | `pad-bob`, `pad-ring`, the hover lift and the press squash        |
| `apps/live/components/canvas/ReactionBurst.tsx`          | Canvas surface, clock, reduced motion, cleanup                    |
| `apps/live/lib/reaction-particles.ts`                    | Pure spawn, step, alpha, draw                                     |
| `apps/live/hooks/canvas/useReactionBursts.ts`            | Bursts keyed by element id; play, receive, clear                  |
| `apps/live/app/document/[id]/useEditorState.ts`          | `fireReaction`: play, broadcast, track                            |
| `apps/live/hooks/collab/useEditorBroadcast.ts`           | `broadcastReaction` and its gate                                  |
| `apps/live/app/document/[id]/useRoomConnection.ts`       | Receives the op                                                   |
| `apps/live/components/canvas/Canvas.tsx`                 | `onWalkIntoReactionPad` runs `onFireReaction`                     |
| `apps/live/components/canvas/BoxedElementView.tsx`       | Mounts `ReactionBurst` beside the label stack                     |
| `apps/live/components/palette/palette-tile-defs.tsx`     | `tools:reaction-<reaction>`, `tileGroup: 'reaction'`              |
| `apps/live/components/palette/BehaviourMenuSections.tsx` | `ReactionMenuSection`                                             |
| `apps/live/hooks/canvas/usePortalSetters.ts`             | `setReactionSelected`                                             |

## Domain and naming

| Term          | Identifier                                         | Meaning                                                          |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Reaction pad  | shape kind `'reaction-pad'`                        | The element                                                      |
| Reaction      | `Reaction`, `ShapeElement.reaction`                | One of `confetti`, `sparkles`, `hearts`, `applause`, `fireworks` |
| Fire          | `fireReaction(element)`                            | Press or walk-on: play locally, then broadcast                   |
| Burst         | `ActiveBurst = { reaction, seed }`                 | One playing animation, keyed by element id                       |
| Seed          | `seq` in `useReactionBursts`                       | Per-client monotonic number; restarts and seeds a burst          |
| Particle      | `Particle`                                         | One drawn mote with its own physics                              |
| Particle kind | `ParticleKind`                                     | `ribbon`, `star`, `heart`, `dot`, `ring`, `spark`                |
| Reaction op   | `{ kind: 'reaction', tabId, elementId, reaction }` | The presence message                                             |
| Pad label     | `REACTION_PAD_LABEL[reaction]`                     | The caption a placed pad takes                                   |
| Hues          | `REACTION_HUES[reaction]`                          | The fixed `[from, to]` pair behind the glow, spot and ring       |
| Spot          | the ellipse under the emoji                        | Where a character stands; the press ring starts there            |

Banned synonyms: "emoji burst", "celebration", "effect", "button" for the pad (it is a pad),
"vote".

## Behaviour and state

### Placing

1. A tile carries `action: { type: 'shape', kind: 'reaction-pad', reaction }`, riding
   `PendingDraw.reaction`. `draw-commit.ts` and `useElementCreation.ts` apply `reaction` and
   `label: REACTION_PAD_LABEL[reaction]` at commit.
2. **Reaction** menu: `setReactionSelected(reaction)` patches `reaction` only; the label stays
   (D131).

### Firing

1. **Press:** `ReactionPadFace` wraps a `<button>` in `usePressWithoutDrag(onFire)`.
2. **Walk-on:** the `useAvatarWalk` arrival effect calls `onWalkIntoReactionPad` once per arrival;
   `Canvas` forwards it to `props.onFireReaction`.
3. `fireReaction(element)`: `played = reactions.play(element.id, element.reaction)`, then
   `broadcastReaction(element.id, played)`, then `track('Element', 'Used', 'ReactionPad')` [QF19].
4. `play` uses `reaction ?? REACTION_DEFAULT` [QF21] and starts the burst.
5. `broadcastReaction` sends nothing when cursors are hidden, the document is not hydrated, or it is
   neither shareable nor in a team (D130).
6. Read-only surfaces pass no `onFireReaction`: the pad is inert and walk-ons do nothing [QF20].

### Receiving

`useRoomConnection` hands `op.elementId` and `op.reaction` to `reactions.receive`, which starts
`isReaction(reaction) ? reaction : REACTION_DEFAULT`. No tab check (D132, gap GF9).

### Playing (`ReactionBurst`)

1. Size the canvas to `(1 + 2·OVERSCAN)` times the pad per axis; backing store at
   `min(2, devicePixelRatio)`.
2. Seed an LCG from `seed`; `scale = clamp(width / 150, 0.55, 3)` (D129);
   `spawnBurst(reaction, scale, rand)`.
3. Reduced motion: `stepParticles(particles, 0.45)`, paint once, `onDone` after 900 ms (D128).
4. Otherwise per frame: `dt = min(0.05, Δt)`, step, paint with `globalCompositeOperation =
'lighter'` from the pad centre; stop when no particle lives or after `BURST_MS` (D127).
5. `onDone` clears the map entry; the canvas unmounts.

### Physics (`stepParticles`)

Per axis, with drag `k` and acceleration `g` (gravity on `y`, none on `x`), the closed form
`v(t) = vT + (v0 - vT)·e^(-k·t)`, `x(t) = x0 + vT·t + (v0 - vT)·(1 - e^(-k·t))/k`, `vT = g/k`;
`k <= 1e-6` falls back to constant acceleration. Negative `age` is a launch delay: the particle
waits unmoved. Sway adds `sin(age·swayRate)·sway·dt` to `x`. A particle dies at `age >= life`.

| Reaction  | Spawn                                                                             |
| --------- | --------------------------------------------------------------------------------- |
| confetti  | 88; 82% ribbons; fan ±1.05 rad about up; 220-640 px/s; gravity 640-900; drag 0.42 |
| sparkles  | 54; 62% stars; 40-190 px/s; gravity -18; drag 0.12; life 0.9-1.7 s                |
| hearts    | 30; rise 190-400 px/s; gravity -55; drag 0.5; sway; delay up to 0.34 s            |
| applause  | 3 rings (delays 0, 0.13, 0.26 s) plus 48 dots sprayed to the sides; gravity 420   |
| fireworks | 3 shells at 0.22 s apart, 26-35 evenly spaced sparks each; gravity 240; drag 0.22 |

All speeds, sizes and gravities scale by `scale`. Alpha fades in over the first 8% of life and out
over the last 28%; stars twinkle.

Invariants:

- **I1:** a burst writes nothing: no document, no undo, no log, no replay.
- **I2:** at most one burst per pad per client; a new fire restarts it.
- **I3:** position after `t` seconds does not depend on how `t` is split into steps.
- **I4:** a burst always ends: particles die, or `BURST_MS` stops it.

## Interfaces and contracts

```ts
export const REACTIONS = ['confetti', 'sparkles', 'hearts', 'applause', 'fireworks'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_HUES: Record<Reaction, readonly [string, string]>;
export const REACTION_LABEL: Record<Reaction, string>;
export const REACTION_EMOJI: Record<Reaction, string>;
export const REACTION_HINT: Record<Reaction, string>;
export const REACTION_PAD_LABEL: Record<Reaction, string>;
export const REACTION_DEFAULT: Reaction; // 'confetti'
export function isReaction(value: unknown): value is Reaction;

// ShapeElement
reaction?: Reaction;

// RoomOp
| { kind: 'reaction'; tabId: string; elementId: string; reaction: string }

export type ActiveBurst = { reaction: Reaction; seed: number };
export function useReactionBursts(): {
  bursts: Map<string, ActiveBurst>;
  play: (elementId: string, reaction: Reaction | undefined) => Reaction;
  receive: (elementId: string, reaction: string) => void;
  clear: (elementId: string) => void;
};
export function spawnBurst(reaction: string, scale: number, rand: () => number): Particle[];
export function stepParticles(ps: Particle[], dt: number): Particle[];
export function alphaOf(p: Particle): number;
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void;
```

| Input                              | Handling                            |
| ---------------------------------- | ----------------------------------- |
| `reaction` absent on the element   | Plays `REACTION_DEFAULT`            |
| `reaction` unknown on the element  | Rejected by `isValidElement` [QF21] |
| `op.reaction` unknown (newer peer) | Plays `REACTION_DEFAULT`            |
| `spawnBurst` with an unknown name  | Confetti physics and palette        |
| `scale` outside `[0.55, 3]`        | Clamped                             |

## Data and persistence

- **Persisted:** `reaction`, `label`, colours.
- **Never persisted:** bursts, seeds, particles. The op is presence: unordered, never logged,
  never replayed to a reconnecting client.
- **Undo:** changing `reaction` is an ordinary commit; firing is not undoable.

## Errors and edge cases

| #   | Case                           | Handling                                             |
| --- | ------------------------------ | ---------------------------------------------------- |
| E1  | Hammering a pad                | Restarts the burst (I2)                              |
| E2  | Peer on a newer build          | Unknown reaction plays confetti                      |
| E3  | Pad moved by a peer mid-burst  | The burst follows the element, not coordinates       |
| E4  | Pad deleted mid-burst          | Its view unmounts; the map entry stays until reused  |
| E5  | Burst for a pad on another tab | Stored, never drawn (D132, gap GF9)                  |
| E6  | Backgrounded tab resumes       | `dt` clamped to 50 ms                                |
| E7  | Standing on a pad              | One burst per arrival; step off and on to fire again |
| E8  | Drag across the pad            | Moves, never fires                                   |
| E9  | Broadcast gate closed          | Local burst only (D130)                              |
| E10 | View-role visitor              | Inert [QF20]                                         |
| E11 | Reduced motion                 | One still frame for 900 ms                           |

## Security and trust

- The op is in `PRESENCE_OP_KINDS`: relayed from any role, never stored.
- Only an element id and a name travel; a peer can at most restart a burst on a pad that exists
  on the receiver's active tab.
- The name is length-bounded only by the room's `MAX_MESSAGE_CHARS` (256 KiB) and senders are not
  rate limited; rendering stays bounded by I2 (gap GF14).

## Performance and limits

- Worst burst: confetti, 88 particles; fireworks up to 105. One canvas per burst.
- Canvas area `(5w)·(5h)` at up to 2x DPR: a default pad is 750x550 CSS px, at most
  1500x1100 backing pixels.
- Per frame: one `stepParticles` pass and one draw per particle; well inside a 16 ms frame.
- Every burst ends within `BURST_MS`; the surface unmounts.

## Presentation and UX

- **Pad:** a `[container-type:size]` wrapper, so `cqw` and `cqh` resolve against the pad. Over
  the element box, a glow `radial-gradient(70% 70% at 50% 42%)` from `tint(from, 0.28)` to
  `tint(to, 0.1)` at 55%, gone by 80%. The emoji at `min(34cqw, 40cqh)` with a
  `tint(to, 0.45)` drop shadow, standing on the spot: `46cqw` by `9cqh`, pulled up `5cqh`,
  `tint(from, 0.55)` to `tint(to, 0.18)`. The label, when set, in a 10.5 px semibold pill on
  `tint(textColor, 0.07)`, truncated; an empty label draws no pill.
- **Colour:** `REACTION_HUES` only, never the theme; the theme reaches the box and the label.
- **Motion:** the emoji bobs (`pad-bob`, 2.8 s, 4% of its height); hover pauses the bob and
  lifts it (`translateY(-6%) scale(1.08)`, `brightness(1.08)`); a press squashes it
  (`scale(0.9, 0.84)`) and throws a `pad-ring` from the spot (600 ms, border in `from`), keyed
  by a press count so every press replays it (D146).
- **No hover card** on the face; the palette tile's hover card and the menu hint explain it.
- **Export:** `reactionPad` draws the wash, the spot, the emoji as text (colour depends on the
  renderer's emoji font) and the label chip, at the canvas proportions; no motion.
- **Burst:** centred on the pad, `z-10` over the face and under selection chrome, pointer-inert.
- **Palette:** a **React** accordion (`palette-create-tabs.tsx`) in Behaviours, one tile per
  reaction with its emoji [QF22].
- **Menu:** accordion **Reaction** (icon: current emoji), three-column tiles, hint line
  `"<hint>. Press the pad, or walk a character onto it in Avatar mode."`.
- **Inert:** read-only surfaces render the same face without a button.

## Accessibility

- Live: native `<button>`, `aria-label` `"Set off <Reaction>"`.
- Inert: `role="img"`, `aria-label` `"<Reaction> pad"`.
- Glyph `aria-hidden`; the burst canvas `aria-hidden`.
- `prefers-reduced-motion: reduce` shows one still frame (I4); the bob, lift, squash and ring
  collapse under the reduced-motion rules in `globals.css`.

## Web experience

- **INP:** a fire is one state update, one socket send and one telemetry call; the canvas paints
  on the next frame.
- **CLS:** the burst canvas is absolutely positioned and overflows the pad without moving layout.
- **Main thread:** the loop stops the frame the last particle dies.

## Observability

No log exists today. Proposed fingerprints (gap, see the report):

| #   | Where                 | Level           | Fingerprint                                            |
| --- | --------------------- | --------------- | ------------------------------------------------------ |
| O1  | `fireReaction`        | `console.debug` | `[reaction] fire id=<id> reaction=<r> via=<via>`       |
| O2  | `receive` fallback    | `console.warn`  | `[reaction] unknown reaction=<name>, playing confetti` |
| O3  | broadcast gate closed | `console.debug` | `[reaction] local-only id=<id> reason=<reason>`        |

`<via>` is `press` or `walk`.

## Testing

| Rule                                                   | Test                                                    | File                                                |
| ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------- |
| Registered kind; default reaction and label            | "is a registered shape kind", "starts on the default …" | `apps/live/lib/reaction.test.ts`                    |
| Five reactions, distinct glyphs, meaningful hints      | "describes all five reactions, with no gaps"            | `apps/live/lib/reaction.test.ts`                    |
| Unknown name guarded                                   | "guards an unknown reaction name from a newer peer"     | `apps/live/lib/reaction.test.ts`                    |
| Not votable                                            | "is a control, not a vote candidate"                    | `apps/live/lib/reaction.test.ts`                    |
| Particle counts, spread, scale and its clamp           | `spawnBurst` block                                      | `apps/live/lib/reaction-particles.test.ts`          |
| Confetti rises and falls; hearts float; shells stagger | `spawnBurst` block                                      | `apps/live/lib/reaction-particles.test.ts`          |
| Each reaction its own palette                          | "uses each reaction its own palette"                    | `apps/live/lib/reaction-particles.test.ts`          |
| Closed-form step, launch delay, death                  | `stepParticles` block                                   | `apps/live/lib/reaction-particles.test.ts`          |
| Frame-rate independence (I3)                           | "is frame-rate independent …"                           | `apps/live/lib/reaction-particles.test.ts`          |
| Alpha fade in, hold, fade out                          | `alphaOf` block                                         | `apps/live/lib/reaction-particles.test.ts`          |
| Op is presence, never logged                           | presence classification tests                           | `apps/api/src/document-room.test.ts`                |
| Telemetry token `ReactionPad`                          | palette census                                          | `apps/live/lib/palette-telemetry-coverage.test.ts`  |
| Export draws the label in its chip                     | "puts a Reaction pad label in its chip"                 | `packages/document/src/svg-render-fidelity.test.ts` |
| One burst per pad, restart on re-fire (I2)             | none                                                    | (gap)                                               |
| Local-first then broadcast                             | none                                                    | (gap)                                               |
| Walk-on fires once per arrival                         | none                                                    | (gap)                                               |
| Reduced motion, `dt` clamp, DPR cap, unmount (I4)      | none                                                    | (gap)                                               |
| Unknown element `reaction` rejected                    | none                                                    | (gap) [QF21]                                        |

## Constants and configuration

| Name                                 | Value                         | Provenance / safe range                       |
| ------------------------------------ | ----------------------------- | --------------------------------------------- |
| `SHAPE_DEFAULT_SIZE['reaction-pad']` | `{ width: 150, height: 110 }` | Press-me square; the burst scale's base width |
| `REACTION_DEFAULT`                   | `'confetti'`                  | The celebration most canvases want            |
| `OVERSCAN` (`ReactionBurst.tsx`)     | `2`                           | Pad-widths per side; 1 to 3                   |
| `BURST_MS`                           | `2600`                        | Hard stop; above the longest life (D127)      |
| DPR cap                              | `2`                           | Backing store; 1 to 2                         |
| `dt` cap                             | `0.05` s                      | One frame at 20 fps                           |
| Reduced-motion instant               | `0.45` s, held `900` ms       | Mid-burst still (D128)                        |
| Scale clamp                          | `[0.55, 3]`                   | Tiny and huge pads stay readable (D129)       |
| Particle counts                      | 88, 54, 30, 3 + 48, 3 x 26-35 | `spawnBurst`, per reaction                    |
| `REACTION_HUES`                      | Five `[from, to]` pairs       | Fixed per reaction, never themed; spec hues   |
| `pad-bob` / `pad-ring`               | 2.8 s loop, 4% / 600 ms       | Ambient and press motion (D146)               |
