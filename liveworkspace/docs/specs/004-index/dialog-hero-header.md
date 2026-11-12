# The dialog hero header

The header a dialog wears when it is one of the apps' main screens rather than a quick question: the start screens'
header band ([The start header wears the same
theme](./one-explorer.md#the-start-header-wears-the-same-theme)) brought to a dialog, the same in every app and every
dialog that has it. A band of art behind a title mark, the title and one line, then the dialog's own controls and its
close. It says at a glance what the dialog does, in the language Home's hero and the start screens already speak.

It is `HeroDialogHeader` in `@liveworkspace/ui` (`packages/ui/src/dialog/hero/`), so the dialogs in
`@liveworkspace/explorer` (Share, History, the team dialogs), `@liveworkspace/community-ui`,
`@liveworkspace/settings-ui` and every product app can wear it. The plain `DialogHeader` stays for every dialog that
does not. Which dialogs wear it is each dialog's spec's call; today: liveplanner's Automations
(liveplanner/docs/specs/026-plan/automations.md "The Automations screen"), Share
(livediagram/docs/specs/007-editor/editor-app.md "Layout, top to bottom", every app's Share alike), Export and Import
(each product's docs/specs/020-import-export/README.md "The dialogs' header", with livediagram's import dialogs that
open from the Explorer), History (livediagram/docs/specs/013-workspace/history.md "The dialog", every app's alike),
Share to Community (liveworkspace/docs/specs/007-community/community.md "Publishing"), Webhooks
([webhooks.md "Managing them"](./webhooks.md#managing-them)), the team dialogs (Members, New Team, Edit Team and
Invite by Link, [one-explorer.md "Teams are run in the Explorer"](./one-explorer.md#teams-are-run-in-the-explorer)),
liveplanner's Configure Board, Setup Board and Setup Sheet (liveplanner/docs/specs/026-plan/plan-board.md "Configure"
and "Setup Board") and Share Form (liveplanner/docs/specs/030-forms/forms.md "Publishing and the form link"), and
livedesign's Choose a Layout (livedesign/docs/specs/007-editor/pages-mode.md "An empty page offers its layouts"); every app's
Settings and liveworkspace.app's (livediagram/docs/specs/007-editor/user-preferences.md "The header",
liveworkspace/docs/specs/010-site/site.md "Settings"), Collaborators
(livediagram/docs/specs/012-collaboration/collaborator-enhancements.md) and Tab Style
(livediagram/docs/specs/011-theme/canvas-and-theme-dialog.md).

## The frame

- **Not a landmark.** Its root is a plain block, not `<header>`: outside sectioning content a `<header>` is a banner
  landmark, so every dialog wearing the hero would give the page it opens over a second banner. The `<h2>` is what
  names it.
- **Height.** From `sm` the header is exactly 100px tall in every dialog, its row centred in it. Nothing in it can
  make it taller: the title and its line are one line each, truncated.
- **On a phone** (below `sm`) it is compact: 12px above and below, a 32px mark, an 18px title that may wrap to a
  second line rather than lose words, and no visible line (it stays for screen readers). The dialog decides whether
  it is full screen or a sheet; under a sheet's grab handle the band runs up under the handle, so the sheet's top is
  the band's colour and the handle stands over it.
- **Title mark.** A 36px tile (32px on a phone), rounded 11px, in the band's wash with a hairline of its line colour,
  holding the art's glyph in a 20 x 20 box in the accent. Decorative: hidden from screen readers.
- **Title.** A real `<h2>` whose id the dialog passes to its panel's `aria-labelledby` (a dialog may keep an
  `aria-label` that names more, as Share does), 20px (18px on a phone), in the app's heading face (below), in the
  band's ink.
- **The line.** One line, 13px, in the band's muted ink, truncated with an ellipsis, never wrapping. Words that
  can run long are said in fewer words, with the full sentence for screen readers, as Share's status does.
- **Actions, then the close.** The dialog's own controls (a primary button, Show Me, Help) sit at the right, then
  the standard close (`DialogCloseButton`) last. Every control keeps its own look, pointer cursor and hover card.
- **The band's edges.** Its top corners follow the panel's (a card's, a sheet's, none edge to edge); a hairline in
  the band's faint colour marks its foot against the dialog's body.

## The title's face

The title is set in the app's heading face, the one Home's hero and the start header use (`startHeadingFace`): the
heavy face tracked in, or livedocuments' Typesetter serif. The shared packages never pass it: an app whose face
differs declares three custom properties in its own CSS, and every other app declares nothing.

| Property                  | Unset (every app but livedocuments) | livedocuments                           |
| ------------------------- | ----------------------------------- | --------------------------------------- |
| `--hero-heading-family`   | the page's own face                 | the system's serif (nothing is fetched) |
| `--hero-heading-weight`   | 800                                 | 600                                     |
| `--hero-heading-tracking` | -0.025em                            | -0.01em                                 |

livedocuments' editor declares them on `:root`; liveworkspace.app declares them where it wears livedocuments
(`[data-explorer-app='livedocuments']`, `[data-community-app='livedocuments']`).

## Colour

The band paints in the host's brand ramp, the colours the rest of the dialog paints in, never a palette of its own:
each colour is a share of a brand stop mixed into the dialog's own ground (white in light, slate 900 in dark). So it
takes each product's accent, light and dark, and a themed tab's accent where the tab retints the ramp (as it does
for every body-portaled dialog). The art reads the colours as tokens and takes no props:

| Token           | Is                                                        | Light                   | Dark                         |
| --------------- | --------------------------------------------------------- | ----------------------- | ---------------------------- |
| `--hero-paper`  | the band's ground                                         | 6% brand 600 into white | 10% brand 400 into slate 900 |
| `--hero-soft`   | a shade deeper: a lane, a soft plate                      | 10%                     | 15%                          |
| `--hero-wash`   | deeper again: the mark's tile, solid pieces that sit back | 15%                     | 22%                          |
| `--hero-faint`  | fine texture lines, rings, the foot's hairline            | 14%                     | 16%                          |
| `--hero-line`   | dots, heavier lines, plate outlines                       | 24%                     | 26%                          |
| `--hero-mark`   | the art's strokes: dashed paths, edges                    | 45%                     | 50%                          |
| `--hero-accent` | the one accent: the glyph, a small solid, the moving ring | brand 600               | brand 400                    |
| `--hero-plate`  | a card or pass lifted off the band                        | white                   | 10% slate 100 into slate 900 |
| `--hero-ink`    | the title                                                 | slate 900               | slate 100                    |
| `--hero-muted`  | the line                                                  | slate 600               | slate 400                    |

The shares are the start band's, so the two read as one drawing. The title and its line read at WCAG AA (4.5:1) on
the paper and the soft in light and dark, in every product's ramp, on liveworkspace.app as each app, and under a
themed tab's accent; tests hold it. Words never sit on the wash.

## Art

Each dialog's art says what the dialog does at a glance, drawn in the visual language of the start bands and
Automations: simple geometric SVG in the tokens, a plate or two lifted off the paper, one accent.

- **A texture** over the paper: dots, a grid, a baseline grid or rings spreading from a corner, at the hero's
  measures (22, 24, 8 and 14px). Dots and grids may fade in from the title's side, so the words sit on plain paper;
  rings fade into the paper as they spread.
- **Corner pieces**, rising from the band's bottom edge, shown from `sm`: at most 96 x 30. They sit behind the
  controls, never over the title mark. On a phone the compact row's mark, title and buttons leave no corner clear,
  so the band shows its texture alone.
- **A centre piece**, optional, shown only once the header is 56rem wide (a container query, as dialogs differ in
  width), right-anchored 12.5rem from the edge (the dialog may move it for wider actions); its width plus that
  offset stay within 24rem. Where it shows, the title and its line stop at 26rem, so the two never meet.
- **The glyph**: the motif as one mark in a 20 x 20 box, in the accent.
- **Motion**: at most one, only where motion is welcome (`motion-safe:`), two or three times over and then still: a
  ring spreading from its centre, or a piece bobbing.
- **Cheap and silent**: no filter or blur, no image, nothing fetched; hidden from screen readers and the pointer.
  Each modal's art is a constant, so the band is drawn once and never again however often the dialog renders.

What each dialog draws:

| Dialog             | Art                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automations        | A grid of dots fading toward the title; a cog rising from the bottom left, a looping arrow from the bottom right; centre: a rule as a flow, a trigger's bolt, a condition's diamond and an action's check joined by a line, a dashed arrow looping back, the bolt's ring spreading twice. Glyph: a bolt.                                                                                           |
| Share              | Rings spreading from the bottom right, where a pass rises from the edge, tilted as if just handed over (a link badge whose ring spreads twice, a perforation, two lines), the two people it reaches beside it; in the bottom left the one sharing, ringed in the accent; a dashed line along the foot from them to the pass. Glyph: a link.                                                        |
| Export             | A grid fading toward the title; in the bottom left the tab as a page rising from the edge, its corner folded; a dashed line along the foot to the bottom right, where it arrives fanned out into format tiles: a picture, a vector path, and in front, in the accent, the file going out, bobbing twice. Glyph: an arrow rising out of a tray.                                                     |
| Import             | A grid of dots fading toward the title; in the bottom left two files fanned, rising from the edge; a dashed line along the foot to the bottom right, where a dashed frame waits, an accent badge with an arrow down at its side and a file dropping in over its edge, bobbing twice. Glyph: an arrow into a tray.                                                                                  |
| History            | The baseline grid fading toward the title, a ruled ledger; in the bottom left a clock rising from the edge, a looping arrow turning back over it; in the bottom right a timeline of versions pinned up from the edge, the newest solid at its end, a dashed arrow arching back from it to the one restored, in the accent, its ring spreading twice. Glyph: a clock turning back.                  |
| Share to Community | Rings spreading from the top right, a spotlight; in the bottom right a shelf along the foot with two cards on it, the owner's card rising onto it between them (an accent sparkle on its corner), bobbing twice over the dashed place it will stand; in the bottom left a heart rising from the edge, two sparkles over it. Glyph: a sparkle.                                                      |
| Webhooks           | A grid of dots fading toward the title; the Automations flow's cousin along the foot: in the bottom left the item as a card, a line leaving its node and a payload (braces on the accent) riding it; a dashed send line along the foot to the bottom right, where it arrives as an arrow at an endpoint, a port whose ring spreads twice as it is delivered. Glyph: a webhook, three nodes joined. |
| Team               | Rings spreading from the bottom right, where three people stand gathered and a fourth, ringed in the accent with a plus badge, has just joined them; in the bottom left an open door, a dashed path along the foot from it to them. Glyph: two people, one in front.                                                                                                                               |
| Team Invite        | Team's drawing (Invite by Link), the newcomer's badge a link, the door's path the link's. Glyph: the same.                                                                                                                                                                                                                                                                                         |
| Settings           | A grid fading in from the title's side; a mixer's three faders rising in the bottom left, each at its own level; two cogs meshing as they rise in the bottom right; centre: a settings card, a switch turned on (its ring spreading twice) over a slider half way along, a hairline between them. Glyph: a cog. The switch's wider actions move the centre piece to 17rem.                         |
| Site Settings      | liveworkspace.app's Settings: one account, every app. The same grid; the apps' tiles rising in the bottom left, each to its own height; the account rising in the bottom right, a cog on its shoulder; centre: the account at the hub of four app tiles, a dashed line to each, its ring spreading twice. Glyph: the Settings cog.                                                                 |
| Collaborators      | The canvas's dots fading in from the title's side; a cursor gliding in on a dashed trail, its name tag beside it, in the bottom left; the presence stack rising in the bottom right, three avatars overlapping, the front one in the accent with its presence ring spreading twice, a cursor pointing at it. Glyph: two people.                                                                    |
| Tab Style          | Rings spreading like a colour wheel's from the bottom right, where a fan of swatch chips rises from the edge, the front one in the accent lifting out of the fan twice; a brush sweeping a stroke of paint along the foot in the bottom left. Glyph: a palette.                                                                                                                                    |

## Where art lives

One file per dialog. Art for a dialog in a shared package, or one every product's copy draws alike, is shared:
`packages/ui/src/dialog/hero/art/<dialog>.tsx`, imported as `@liveworkspace/ui/dialog-hero-art/<dialog>`. Art for
one product's own dialog lives beside that dialog in the product's app, as `<Dialog>HeroArt.tsx`. Either way the
file exports one art object named after the dialog, and the shared folder's test holds every file in it to the art
rules above.
