# Opening screen picture: blueprint

Derived from [The opening screen](../new-document-route.md#the-opening-screen) in New document route. The spec
decides; this file only adds engineering precision.

Scope, by file:

| File                                                         | Role                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `apps/editor/components/chrome/SpaceBuildAnimation.tsx`      | The picture: room, furniture, characters, as SVG             |
| `apps/editor/components/chrome/space-build-scene.ts`         | Geometry, the loop's timeline and the CSS it generates       |
| `apps/editor/components/chrome/DocumentLoading.tsx`          | The opening screen; places the picture above the label       |
| `packages/ui/src/index.ts` (`@livehuddle/ui`)                | Re-exports the shared `useLoopPhase` (loop continuity)       |
| `apps/editor/components/chrome/SpaceBuildAnimation.test.tsx` | Art, accessible name, still frame, compositor-only keyframes |

## Domain and naming

| Term        | Identifier                  | Meaning                                                            |
| ----------- | --------------------------- | ------------------------------------------------------------------ |
| The picture | `SpaceBuildAnimation`       | livehuddle's loading illustration, a Space coming to life          |
| Walker      | `Walker`, `.lhs-<who>-walk` | A character on its way in: one group per facing, two stride frames |
| Sitter      | `Sitter`, `.lhs-<who>-sit`  | The same character seated, shown once its walk ends                |
| Who         | `'you' \| 'sam'`            | Your character (no chip) and the teammate (name chip "Sam")        |

All class names, keyframes and the gradient id carry the `lhs-` prefix.

## Geometry

Canvas units throughout, so pieces match the canvas and the marketing hero (`apps/marketing/public/hero/*.svg`)
size for size: `viewBox="-24 -34 528 392"`.

- Room: 480 x 320, walls 10 thick (`.lhs-w`: floor fill, 2-unit slate outline), name band 27 tall under the top
  wall, doorway gap `x 192..288` in the bottom wall with 6 x 10 posts, a 3 x 84 leaf hinged at `(199.5, 315)` and a
  dashed 84-unit swing arc.
- Furniture is the hero's markup with the theme's tokens: rug (ellipses at `(240, 156)`), meeting table piece at
  `(124, 76)` less its end chairs (two far chairs, two near), bookshelf at `(20, 46)` scaled 0.58, coffee machine at
  `(392, 40)`, plants at `(22, 214)` and `(402, 214)`.
- Characters: the Avatar sprite's 16 x 24 grid at 2.5 units a pixel (a 56-unit figure), placed by the feet. Colours
  from `@livehuddle/avatar/palette`; shirts `#0ea5e9` / `#8b5cf6` with the sprite's 22% darker side precomputed
  (`#0b81b6`, `#6c48c0`). Hair: you `short`, Sam `bob` (female build, one-pixel shoulder inset). Views: back
  (walking up), profile (left, mirrored for right), seated front (body five rows down, legs folded).
- Paths (feet): you `(228,350) → (228,290) → (112,290) → (112,128) → (210,128)`; Sam mirrored about `x = 240`
  ending at `(270,128)`. A sitter sinks 4 units below its last walking point so the table's opaque underlay hides
  its legs.

## Behaviour and timeline

One loop of `LOOP_MS = 9000`, every moment a percentage of it (1% is 90ms). Front-loaded: loads usually finish
within a second or two, so the room is built, the door open and the first character walking by about 0.6s, and
everything is furnished by about 1.2s.

| %        | What happens                                                                        |
| -------- | ----------------------------------------------------------------------------------- |
| 0 to 3   | Floor fades and scales up from 0.96                                                 |
| 0 to 6   | Walls draw clockwise from the top-left in overlapping strokes (`scaleX` / `scaleY`) |
| 2        | Door posts and threshold pop; the leaf shows closed (rotated 90deg)                 |
| 3 to 8   | Leaf swings open to 0deg; the arc fades in                                          |
| 5 to 7   | Name band fades in                                                                  |
| 5 to 13  | Rug, table, bookshelf, coffee machine, plants pop (scale 0.6, 1.06, 1)              |
| 7 to 35  | You walk in at a constant pace, facing each segment's direction, then sit           |
| 11 to 39 | Sam follows, then sits                                                              |
| 39 to 43 | The pool of light scales in round the pair                                          |
| 41 to 58 | Your equaliser talks; then Sam's, 57 to 76                                          |
| 90 to 96 | The whole scene fades out; everything resets unseen at 100%                         |

- Facing switches and the walker-to-sitter handover are instant (two stops 0.01% apart).
- The stride: frames `.lhs-f0` / `.lhs-f1` swap on their own `360ms steps(1, end)` loop; only seen while walking.
- Continuity: `useLoopPhase(ref, 'space', LOOP_MS, '--lhs-delay')`, every loop's `animation-delay`.

## Presentation, accessibility and motion

- Theme by CSS variables set with Tailwind arbitrary properties on the wrapper, flipped by the `dark:` variant:
  `--lhs-floor` (`#f5f0e6` / `stone-800`), `--lhs-line` (`slate-400` / `slate-500`), `--lhs-piece`
  (slate at 32%), `--lhs-shadow`, `--lhs-ink`, `--lhs-rug` (`#fef9e7` / `slate-800`), the hero's light and dark
  values.
- The `<svg>` is `role="img"` with `aria-label="A Space coming to life"`; an empty `label` makes it `aria-hidden`.
- Base styles are the still frame: walkers hidden, sitters, bars, chip and light shown. Animations are declared only
  under `prefers-reduced-motion: no-preference`; `reduce` and the in-app `:root.reduce-motion` set
  `animation: none` on the picture, because the editor's global rule would otherwise collapse each loop to its last
  frame, the dissolved Space.

## Performance and limits

- Keyframes animate only `transform` and `opacity` (walls use `vector-effect: non-scaling-stroke` so their outline
  holds while they scale), so the loop composites without layout or paint of the page.
- No sprite module, walk code or canvas code: the figures are a few hundred static rects. The CSS string is built
  once at module load.
- It replaces `DiagramBuildAnimation` in this app, which no other livehuddle surface imported.

## Testing

| Behaviour                                          | Test                                        |
| -------------------------------------------------- | ------------------------------------------- |
| Space art, named image, decorative when unlabelled | `SpaceBuildAnimation.test.tsx`              |
| Still frame under reduced motion                   | `SpaceBuildAnimation.test.tsx`              |
| Keyframes are compositor-only                      | `SpaceBuildAnimation.test.tsx`              |
| Walk segments face the way they go, end at seats   | `SpaceBuildAnimation.test.tsx` (`segments`) |
| Opening screen shows the Space picture             | `DocumentLoading.test.tsx`                  |
| Loops stay within the motion budget                | `apps/editor/motion-budget.test.ts`         |
