# Brand mark

The livediagram logo is the **Living Prism**: an isometric glass cube whose translucent faces fold over one another,
with a faint diagram (two nodes joined through a centre node) inside and a live signal pulse running along its front
edge. It reads as "a workspace with a diagram living in it". The **wordmark** beside it reads `livediagram`, with
`live` in the accent and `diagram` in ink.

## The mark

- Four faces, back to front: the top plate, the rear right face, the left face and the bottom fold. The two faces that
  overlap another blend into it (multiply in light mode, screen in dark), so the folds read as glass rather than paint.
  The blend is isolated to the mark: it never mixes with the page behind.
- Each face is a gradient over one **prism palette**, six stops from light to dark: `light`, `vivid`, `primary`,
  `deep`, `dark` and `highlight`.
- The brand palette is the one from the Living Prism source artwork: sky into blue into deep indigo.

## Two drawings

| Drawing   | Where                                                     | What it carries                                                           |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `compact` | Below 48px: the header, favicons, list icons, small tiles | The four faces and their gradients only                                   |
| `full`    | From 48px up: app icons, social cards, large marketing    | Faces plus the inner diagram nodes, glass edge sheen and the signal pulse |

The detail in `full` is under a pixel wide at header size, so `compact` drops it rather than letting it smudge.

## Light and dark

The mark has a light and a dark palette. Dark is brighter in its mid stops and darker at its deepest stop, so the cube
holds its edges on a dark surface. The mark follows the page's scheme wherever it is drawn live. Favicons follow the
browser's `prefers-color-scheme`. Static rasters (PNG icons, the Apple icon, social cards) are drawn on white and use
the light palette.

## Theme accent

In the editor the mark and the wordmark's `live` take the active tab's theme accent (its element stroke). One accent
becomes a whole prism palette: the brand palette's shape (how much lighter, darker, more or less vivid and how far round
the hue wheel each stop sits from `vivid`) is carried onto the accent. So a pink theme gives a pink glass cube with the
same depth as the blue one.

- Lightness stays near the brand's, moving at most a little toward the accent, so a near-black or pale theme accent
  still gives a cube that reads on both light and dark headers.
- A grey accent gives a grey cube.
- A theme with no accent (the default) shows the brand palette exactly.
- A theme change crossfades the colours over the micro duration; reduced motion skips it.

## Mono

On a solid brand tile (marketing's comparison badges, the "Why pick livediagram" card) the mark draws in one colour, the
tile's text colour, with each face at its own opacity so the fold still shows.

## Wordmark

`live` is the accent: `brand-600` in light mode, `sky-400` in dark, or the theme accent in the editor. `diagram` is the
surrounding ink (`slate-900`, `slate-100` in dark). The name never carries `.app`. The wordmark is a logotype, which WCAG
1.4.3 exempts from contrast minimums, and the contrast audits skip it by its `data-logotype` mark. The plain-text
wordmark in email follows the same split: `live` in brand blue, `diagram` in ink.

## Size and motion

The mark sits a size up from the wordmark text (28px beside the 18px header wordmark, 20px beside 16px), since a solid cube reads smaller than a line icon in the same box.

Hovering or keyboard-focusing a linked logo opens the prism: the faces drift apart along the cube's own axes (the lid up, the sides out on the isometric diagonals, the bottom fold down) over the micro duration, so the glass layers separate and their blended overlaps shift, then settle back when the pointer leaves. The faces may drift past the mark's box; nothing clips them. Reduced motion holds the cube still.

## One source

Every copy of the mark (the React component, the favicons, the logo files in `marketing/media/logo/`, the PNG icons, the
Apple icon and the social card) is drawn from one geometry and palette module in `@livediagram/ui`. Static files are
regenerated from it and a test fails if one drifts.
