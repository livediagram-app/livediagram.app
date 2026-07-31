# 116 — Stickers

Status: shipped

## What

A **Stickers** category in the palette, in the **Decorate** band (spec/110),
between Icons and Tech — and a **`sticker` shape kind** behind it.

A sticker is the thing you slap on a board: a die-cut plate with a soft shadow,
in colours that are its own. Two flavours:

- **Emoji** — ~193 colour emoji on a white die-cut plate.
- **Badges** — 32 word pills that no emoji says: APPROVED, BLOCKED, WIP,
  NEEDS REVIEW, AT RISK, P0, OUT OF SCOPE, OWNER?, MVP, …

Eleven groups, browsed by drill-in with a breadcrumb and searched across all of
them at once — the same navigation every catalogue tab uses (spec/109):

| Group         | What it holds                                                               |
| ------------- | --------------------------------------------------------------------------- |
| **Badges**    | The word pills, tone-coloured by what they mean                             |
| **Reactions** | Responding to somebody's work: thumbs, clap, heart, fire, 💯, eyes          |
| **Feelings**  | The face set: happy, laughing, thinking, confused, sad, angry, mind-blown   |
| **Status**    | Check, cross, warning, traffic-light dots, blocked, WIP, new, trend arrows  |
| **Direction** | Arrows, pointing hands, pins, compass, play — pointing at things on a board |
| **Celebrate** | Party popper, confetti, trophy, medals, cake, gift, crown, rocket           |
| **Decorate**  | Sparkles, rainbow, sun, flowers, hearts in every colour, gems               |
| **Meeting**   | Timers, calendar, speech + thought bubbles, megaphone, mic, coffee, brain   |
| **Work**      | Bug, wrench, gear, key, folder, package, laptop, money, target              |
| **People**    | Person, people, raising a hand, bowing, worker, detective, walking          |
| **Fun**       | Robot, alien, unicorn, cat, pizza, dice, controller, music                  |

Groups are **disjoint** — every sticker has exactly one home, pinned by a test,
the same rule the icon categories follow. Search cuts across all eleven, and a
badge also matches on the word on its pill, so "blocked" finds BLOCKED.

## A sticker is NOT an icon

The first cut of this made stickers ordinary `icon` elements, on the reasoning
that everything an icon does on the canvas a sticker also wants. That was
wrong, and it showed the moment one landed: it looked exactly like an icon,
because it _was_ one. An icon is a glyph you tint, caption and fold into a
shape's label. A sticker is a physical-feeling object you stick on the board.
Those want opposite treatment on every axis, so a sticker is its own shape kind
carrying its own `stickerId`:

|                     | Icon                            | Sticker                         |
| ------------------- | ------------------------------- | ------------------------------- |
| Artwork             | line art, one colour            | die-cut plate + shadow + art    |
| Theme tint          | takes the element stroke colour | never — its colours are its own |
| Caption             | a label band under the glyph    | none, ever                      |
| Fold into a shape   | yes, becomes an inline glyph    | never                           |
| Colours / Border UI | stroke + text swatches          | none (nothing to recolour)      |

Mechanically that means: `'sticker'` in `ShapeKind`, `stickerId` on
`ShapeElement`, its own `STICKER_DND_MIME` (so a drag onto a shape can't be
mistaken for an icon fold), `supportsColours` false, membership in
`SELF_PAINTING_SHAPES` (no wrapper border) and in `isSelfDrawingShape` (no
label editor, no markers, no text alignment, no morph), and exclusion from
`acceptsInlineIcon` and from the isometric extrusion.

**No text, by any route.** The selection toolbar drops its Add-text button,
double-click doesn't open an editor, and type-to-edit refuses — all three off
the one `isSelfDrawingShape` predicate, which already documented itself as
exactly this behaviour. A caption under a die-cut sticker is the icon treatment
it exists not to be.

## The artwork is built once

`stickerArt(def)` in `@livediagram/icons` returns `{ viewBox, markup }` and is
the ONLY place a sticker is drawn. The editor canvas, the palette tile, the
SVG / PNG / PDF export, the api worker's share thumbnail and the MCP render all
call it. A sticker that looked one way in the editor and another in the export
would defeat the point of it being a sticker.

Three layers: a soft shadow, the white die-cut plate, then the content (an
emoji glyph, or a word on a tone-coloured pill whose font size is computed from
the character count so "P0" and "OUT OF SCOPE" both fit).

Deliberately **no SVG `<filter>`** for the shadow. A filter needs a `defs` id,
and the export packs every element into one document where those ids collide;
the shadow is an offset rounded rect at low opacity instead, which renders
identically everywhere including headless.

## No automatic tilt

A sticker was briefly given a small tilt on drop, on the theory that an angle
is what makes one read as stuck on rather than drawn in. It was wrong in
practice: an element that arrives at an angle you did not ask for reads as a
glitch, not as character, and the first thing you want to do is straighten it.

Stickers land **square to the canvas**, like every other element. Rotation is
still there by hand, from the element's Rotation menu, for anyone who wants the
scrapbook look.

The attempt did surface a real bug, which is fixed and worth naming because it
was never sticker-specific. The pop-in entry animation sets
`transform: scale(...)`, and a keyframe that touches `transform` **replaces**
the element's inline `transform: rotate(Ndeg)` for its whole duration — so any
rotated element popped in flat and then visibly snapped to its angle when the
class dropped. The keyframe now multiplies in `--lvd-enter-rot` (0deg when
unset), which BoxedElementView publishes alongside the rotation. Duplicate a
rotated shape, or paste one, and it now enters at its angle.

## Legacy emoji stay icons

Spec/85 shipped ~60 of these emoji as **icons**, so saved diagrams hold
`{ shape: 'icon', iconId: 'emoji-thumbs-up' }` elements. Those are **not
migrated**: silently restyling somebody's saved diagram with a plate, a shadow
and a tilt is not ours to do.

So the icon catalogue keeps rendering them exactly as it always has. Those
entries are **derived** from the sticker catalogue rather than hand-copied
(`LEGACY_EMOJI_ICONS` in `icon-catalog-2.ts`), so the two can't drift. Only the
palette moved: the Emoji category is gone from `ICON_CATEGORIES`, the Icons
tab's search and the global "Add to canvas" list both filter legacy emoji ids
out, and Stickers is the one place you browse or place them.

Sticker ids keep the `emoji-` prefix for the same reason — an id is what a
saved element, an API payload and an MCP call carry.

## What we deliberately did NOT build

- **A raster / vector sticker pack of our own art.** Native emoji render at any
  size, in every export path we have, on every platform, in colour, for zero
  bytes. Hand-drawn art would be a new asset pipeline for a worse result.
- **Editable badge text.** A badge says one of 32 agreed things; a free-text
  badge is a sticky note, which the palette already has.
- **Very new emoji.** Entries stay at Emoji 13.0 and below so a sticker never
  lands as a tofu box on an older machine. That rules out 🫡, 🫧 and friends.

## Tests

`stickers.test.ts` pins the group coverage (every sticker in exactly one group,
every group id resolving), the catalogue floors for both flavours, that every
entry builds art drawing both the plate and its own content, and the drop
geometry for each flavour. The public
OpenAPI schema is regenerated, so `sticker` / `stickerId` are part of the
documented wire format.
