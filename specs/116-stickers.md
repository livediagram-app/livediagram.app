# 116 — Stickers

Status: shipped

## What

A **Stickers** category in the palette, in the **Decorate** band (spec/110),
between Icons and Tech.

It holds the colour-emoji art a board actually reaches for: reactions to
somebody else's work, feelings, status marks, things that point, celebration,
decoration, meeting props, work objects, people, and a bit of fun. Around 190
of them, browsed by group with a breadcrumb and searched across all groups at
once — the same drill-in every catalogue tab uses (spec/109).

The groups, in order:

| Group         | What it holds                                                               |
| ------------- | --------------------------------------------------------------------------- |
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
the same rule the icon categories follow. Search cuts across all ten, so a
sticker filed under Work is still one keystroke away from anywhere.

## A sticker IS an icon

No new element kind, no new shape kind, no second catalogue, no second drag
MIME, no separate renderer. A sticker is an ordinary `IconDef` whose art is one
`text` prim — exactly what spec/85 built emoji as — so it inherits, for free:

- click-to-add and draw-to-size placement (`addIcon`)
- **drag onto a shape** to become that shape's inline icon beside the label,
  which is precisely what a status sticker wants to be
- drag-to-canvas via `ICON_DND_MIME`, Favourites tiles (spec/78), the global
  search "Add to canvas" group, canvas rendering, export, the api share
  thumbnail, and the MCP render
- theme tint being a natural no-op: colour-emoji glyphs ignore SVG stroke and
  fill, so a thumbs up stays yellow however the diagram is restyled

Telemetry rides the existing `Element·Added·Icon`; the browse + search events
are `UI·Opened·StickerGroup` and `UI·Searched·StickerSearch`.

## It replaces the Emoji category inside Icons

Spec/85 shipped ~60 emoji as a category **inside** the Icons tab. That was the
cheap way in, and it was the wrong home: Icons is a catalogue of single-colour
line art that takes the theme colour, and one category in it did neither.

So the Emoji category is **gone from `ICON_CATEGORIES`**, the Icons tab's
search **excludes sticker ids**, and Stickers is the one place you browse or
search them. There is no duplication between the two tabs in either direction.

What did NOT change: the **ids**. Every entry keeps its shipped `emoji-`
prefix (`emoji-thumbs-up`, ...), because an id is what a saved element, an API
payload and an MCP call carry — renaming them would blank the glyph on every
diagram that already uses one. `STICKER_ID_PREFIX` names the prefix in one
place so the "is this a sticker" check isn't a bare string literal.

The catalogue data moved from `emoji-catalog.ts` / `EMOJI_CATALOG` to
`sticker-catalog.ts` / `STICKER_CATALOG` and grew from 59 entries to ~190. It
is still concatenated onto `ICON_CATALOG_2`, so every headless renderer and the
editor's async icon chunk keep seeing exactly one line-art catalogue.

## Bigger tiles

Sticker tiles draw the glyph at 24px, not the Icons tab's 18px, in a 4-column
grid rather than 5. A line-art glyph is a shape you read from its outline and
survives being small; an emoji is a tiny illustration, and 😌 against 😔 at
18px is a guess.

## What we deliberately did NOT build

- **A raster / vector sticker pack of our own art.** Native emoji render at any
  size, in every export path we already have, on every platform, in colour, for
  zero bytes. Hand-drawn sticker art would be a new asset pipeline for a
  worse result.
- **A "sticker" element kind.** Everything a sticker does on the canvas — sit
  there, scale, tint-proof, fold into a shape — the icon element already does.
- **Very new emoji.** Entries stay at Emoji 13.0 and below so a sticker never
  lands as a tofu box on an older machine. That rules out 🫡, 🫧 and friends.

## Tests

`stickers.test.ts` pins: every group id resolves to a catalogue entry, every
sticker sits in exactly one group, the ~190-entry floor, and that no sticker
strays from the one-`text`-prim geometry. `icons.test.ts`'s "every icon is in
exactly one category" check now excludes sticker ids — they are covered by the
sticker test instead — so an unfiled sticker still fails a build.
