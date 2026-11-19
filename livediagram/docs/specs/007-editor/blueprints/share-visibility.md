# Share visibility blueprint

How the corner card's Share button and its hover legend show who can see an item
([editor-app.md "Header actions"](../editor-app.md#header-actions)). The code is shared by every editor, in
`packages/workbench/src/components/chrome/`.

## Domain and naming

- `ShareState`: `'offline' | 'private' | 'shared' | 'team' | 'community'` (`share-states.tsx`). `community` is the
  Public state; its words are `COMMUNITY_PUBLIC_LABEL`.
- `SHARE_LADDER`: the states from narrowest to widest, `offline, private, shared, team, community`. The legend's scale,
  the order a combination is listed in and the direction its hues sweep.
- `ItemVisibility`: `{ team?, offline?, community? }`, with the separate `shareable` (a share link exists).

## Behaviour and state

- `shareStatesOf(shareable, visibility)` answers every state that applies, in ladder order: `['offline']` when
  offline (nothing else counts), else each of `shared` (shareable), `team`, `community` that is true, else
  `['private']`. Never empty.
- `shareStateOf(shareable, visibility)` keeps the single leading state for callers that need one: offline, then
  community, shared, team, private (unchanged).
- `shareStatesLabel(states)`: the states' words joined for reading, `Shared`, `Shared and Team`,
  `Shared, Team and Public`.

## Interfaces and contracts

- `ShareVisibilityButton` takes `state` (the leading one) and optional `states` (all that apply, defaults to
  `[state]`). `EditorCornerActions` passes both, so every editor gets the combination with no change of its own.
- `VisibilityLegend` takes `current` and optional `states` the same way.
- The button carries `data-share-state` (the leading state) and `data-share-states` (every state, space separated).

## Presentation and UX

- One state: the button's words take that state's ink (`VISIBILITY_TONE[*].ink`), as before.
- Several: `SHARE_SWEEP` (in `ShareVisibilityButton.tsx`) holds one literal class string per combination
  (`shared team`, `shared community`, `team community`, `shared team community`): the word span gets a left to right
  `bg-gradient-to-r` from the first hue (via the middle one when there are three) to the last, clipped to its text
  (`bg-clip-text text-transparent`), light 700s and dark 300s. The glyph's stroke is a `linearGradient`
  (`userSpaceOnUse` across the glyph's 16-unit box, so every child shares one sweep), its stops coloured by the
  states' ink classes through `currentColor`, referenced by an id from `useId`. The gradient's `svg` is absolutely
  placed and zero-sized, out of the button's flex flow.
- Legend: every state in `states` gets the current stop's look (filled in its own hue, ringed, bold name); the track
  fills to the widest. Its top names the combination (`shareStatesLabel`), each glyph in its hue, one sentence per
  state, and the rings light out to the widest. The combination's words sit in the hero's shared grid cell like
  every single state's, so hovering stops never changes the legend's height. Hovering a stop that applies shows it
  as current ("Who Can See This"); any other stop shows "If It Were".

## Accessibility

- The button's name is `Share, <shareStatesLabel>`; its description joins each state's sentence.
- Contrast: every colour on the sweep (oklab interpolation, as Tailwind v4 draws it) is 4.5:1 or more on the card
  (white, slate-900) and its hover wash (slate-100, slate-800). `share-ink.test.ts` samples the path.
- Forced colours replace the text colour, so the clipped gradient falls back to the system's text colour.
- No motion is added.

## Performance and limits

- The set is a handful of boolean checks per render. A combination adds one zero-sized `svg` with a two or three
  stop gradient to the button; single states render as before.

## Testing

- `share-states.test.ts`: the state set and the leading state for every combination of the inputs.
- `ShareVisibilityButton.test.tsx`: the classes, the gradient's stops and the accessible name per combination.
- `VisibilityLegend.test.tsx`: several stops marked at once, the track's fill, the combined hero.
- `share-ink.test.ts`: the contrast of every hue and sweep.
