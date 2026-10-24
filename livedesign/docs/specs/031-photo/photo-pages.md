# Photo pages

A **photo page** is one of the kinds of page ([Pages](../007-editor/pages-mode.md) "Page kinds"):
a picture to edit. It holds a **photo**: a stack of layers of pixels, adjustments and text, composited into one
picture the size of the page. It is edited with the tools an image editor has (brushes, selections, retouching,
gradients, transforms, adjustments and filters) on the page itself, with everything else Pages offers around it:
the row of pages, ordinary elements on top, presenting, exports and real-time collaboration.

Everything [Pages](../007-editor/pages-mode.md) says of pages applies to a photo page except where this
spec says otherwise. The layer stack is [Photo layers](photo-layers.md), the tools [Photo tools](photo-tools.md),
the adjustments and filters [Photo adjustments](photo-adjustments.md), and where the pixels live [Photo
store](photo-store.md).

## Domain language

| Term               | Means                                                                                               | Never called          |
| ------------------ | --------------------------------------------------------------------------------------------------- | --------------------- |
| **photo page**     | A page of kind `photo` (`Page.kind`).                                                               | image page, canvas    |
| **photo**          | The photo page's picture: its pixel size and its layer stack (`Tab.photos[pageId]`).                | design, project       |
| **pixel size**     | The photo's width and height in pixels, each 1 to the pixel cap.                                    | resolution, dimension |
| **layer**          | One entry of the photo's layer stack ([Photo layers](photo-layers.md)).                             | element, sheet        |
| **active layer**   | The layer the tools act on: each person's own, for the session.                                     | current, focused      |
| **composite**      | The layers drawn together, bottom to top, as the page shows them.                                   | flattened, render     |
| **selection**      | The pixels the next tool or operation is limited to: each person's own, a soft mask over the photo. | marquee (a tool)      |
| **photo tool**     | A tool of the photo tools ([Photo tools](photo-tools.md)).                                          | brush (one tool)      |
| **photo tools**    | The tool groups and colours the palette strip holds while a photo page is in focus.                 | toolbox, dock, rail   |
| **options flyout** | The card hanging from the tool's button in the palette, holding the photo tool's options.           | tool settings         |
| **Photo panel**    | The panel on the right holding **Layers**, **Adjust** and **History**.                              | sidebar               |
| **colours**        | The person's **foreground** and **background** colours, which the painting tools use.               | swatches              |
| **pixel cap**      | The most pixels a side may have: 8192 on a desktop, 4096 on a phone or tablet (a coarse pointer).   | max size              |

## A photo page

- **Kind**: `kind: 'photo'`, fixed when it is made, as every kind is.
- **Size**: a photo page is as big as its picture. Its **pixel size** is the photo's (`width`, `height`), and its
  sheet on the canvas is that size scaled so its longer side is at most **2048** canvas px (a picture up to 2048 px
  shows at one canvas px per pixel; a larger one is scaled down, never up). It offers no paper size and no
  orientation: its panel's Page tab offers **Image Size** and **Canvas Size** instead ([Changing the size](#changing-the-size)).
  Its size is stored on the page as `size: 'photo'` with its `fit` sides (the sheet's sides in canvas px, whole
  numbers); a stored photo page whose photo is missing is read as an empty, transparent 1920 x 1080 photo.
- **The label** reads `<name or Page n> · <width> x <height> · Photo`.
- **Background**: a photo page has no page background, pattern or motion: the photo is its background. Where the
  photo is transparent the page shows the **transparency checkerboard** (8 screen px squares, slate-100 and white
  in light chrome, slate-800 and slate-900 in dark), which is a view and never exported. A stored background on a
  photo page is dropped.
- **Margin**: none. Snapping offers the page's edges and centre lines, not a margin.
- **Elements on top**: ordinary elements (text, shapes, arrows, stickers, stickies) may sit on a photo page as on
  any page, drawn over the composite. They are not layers: they move, style and export as elements do, and
  **Rasterize Into Layer** (an element's context menu on a photo page) draws one into a new pixel layer and removes
  the element, one edit. Exports draw them over the composite.
- **No layouts**: a photo page has no layouts, no Start From a Layout card and no Tidy. Laying loose content out
  into pages never makes a photo page.
- **Locking** works as on any page: a locked photo page takes no photo tool and no layer change.

## Making a photo page

- **The first page's choice** offers a **Photo** card: "A picture to edit: layers, brushes, adjustments and
  filters.", which makes the tab a photo tab. A photo tab holds only photo pages ([Pages](../007-editor/pages-mode.md)
  "One kind a tab"): on it the **+** adds another photo page, an unstarted one of the last photo's size.
- **The New Photo card**: choosing Photo makes the page at once and shows, centred on it while the photo has no
  pixels and nobody has chosen, a card **Start a Photo** (held at one screen size, as the layout card is):
  - **Open a Picture**: the image picker ([Images](../009-elements/images.md) "Image picker modal": Upload, Gallery,
    Search). The picked picture becomes the photo's first layer, **Background**, at its own pixel size (scaled
    down to the pixel cap, keeping its shape, when larger), and the page takes its size.
  - **Blank**: preset tiles, each drawn to scale: **HD (1920 x 1080)**, **4K (3840 x 2160)**, **Square (1080 x 1080)**, **Portrait Post (1080 x 1350)**, **Story (1080 x 1920)**, **A4 Print (2480 x 3508)**, **Icon (1024 x 1024)**, and **Custom** (width and height fields, 1 to the pixel cap, a chain to keep the shape). One press
    of **Create** makes the photo with one layer, **Background**, transparent (the checkerboard). The card offers no fill choice;
    a different background is painted afterwards (Paint Bucket, Fill).
  - Escape or the card's close keeps the page as a blank transparent 1920 x 1080 photo.
  - Only someone who may edit sees the card; a Viewer sees the checkerboard.
  - A photo so started picks up a tool when none is in hand, so the next press does something: the **Brush** on a
    blank photo, **Move** on a picture (opened, dropped, pasted or a PSD). A tool already in hand stays.
- **A dropped or pasted picture**: a picture file dropped on a photo tab's **+** (Add Page) or on an unstarted photo page,
  or pasted while one is in focus, starts the photo from it, as Open a Picture does. Dropped or pasted on a started
  photo page, it lands as a **new layer** centred on the page ([Photo layers](photo-layers.md) "Layer operations").
- **Edit as Photo**: an image element's context menu offers **Edit as Photo**: a new photo page after
  the image's page (or after the last page), started from the image's picture, and the view moves to it. The
  element is left as it is. Offered for an image that has a picture, for someone who may add pages, on a photo
  tab alone: a new photo page joins only a tab of photos ("One kind a tab"), so on a logo or wireframe tab the
  item is not offered.
- **Templates**: the **Photo Edit** template (its own kind id `photo-edit`, in the **Photos** category) starts a
  tab whose one page is an unstarted photo page.

## Working on a photo page

A photo page is **in focus** for a person when it is the page they are on ([Pages](../007-editor/pages-mode.md)
"Getting around the pages": they went to it, pressed on it, or it is in view on opening). While a photo page is in
focus and the person may edit it:

### The photo tools

The photo tools sit in the **palette strip** at the top of the canvas ([Toolbar layout](../007-editor/toolbar-layout.md)),
in place of its categories, their tiles and More: the strip keeps its selection mode picker first and Search last.
Between them, at the strip's tile size:

- **The tools used most**, each its own button with its group's last used tool showing: **Move**, **Marquee**,
  **Brush**, **Eraser**, **Crop** and **Text**. A press takes that tool (its options stay shut); a press on the tool in
  hand opens its options flyout, whose **Tool** section offers the group's other tools. No long press.
- **The categories**, as the palette's category bar has them (a glyph and a name, a marker under the open
  one, tinted while it holds the tool in hand that no pinned button shows): **Select**, **Paint**, **Retouch** and
  **Shapes**. A press opens the category's flyout in the category flyout's look: a header (glyph, name, line, how many
  tools), a row per tool group (its glyph, name, line and key), and a footer saying what the pointed-at row is. A
  group of one tool takes it at a press; a group of several opens its tools in a panel beside the flyout (on its
  right where the window has room, else its left, level with the row), as a card tile's presets do, opening as the
  pointer reaches the row; a press on a tool there takes it. **Shapes** lists its Shape group flat instead: Text,
  Rectangle, Ellipse and Line, a row each, no panel beside. Taking a tool closes both; a press outside them and
  Escape close them too.
- **The colours**, last.

The flyouts sit in a portal, placed against the window, never carried by the strip's own scale. When focus leaves the
photo page the strip's categories come back as they were. The groups and their tools ([Photo tools](photo-tools.md)):

| Category | Group        | Tools (shortcut)                                             | On the strip |
| -------- | ------------ | ------------------------------------------------------------ | ------------ |
| (none)   | Move         | **Move** (V)                                                 | yes          |
|          | Crop         | **Crop** (C)                                                 | yes          |
| Select   | Marquee      | **Rectangle Select** (M), **Ellipse Select** (M)             | yes          |
|          | Lasso        | **Lasso** (L), **Polygon Lasso** (L), **Magnetic Lasso** (L) |              |
|          | Smart Select | **Quick Select** (W), **Magic Wand** (W)                     |              |
| Paint    | Brush        | **Brush** (B), **Pencil** (B)                                | yes          |
|          | Eraser       | **Eraser** (E), **Background Eraser** (E)                    | yes          |
|          | Fill         | **Gradient** (G), **Paint Bucket** (G)                       |              |
|          | Eyedropper   | **Eyedropper** (I)                                           |              |
| Retouch  | Heal         | **Spot Heal** (J), **Heal** (J), **Red Eye** (J)             |              |
|          | Clone        | **Clone Stamp** (S)                                          |              |
|          | Focus        | **Blur** (R), **Sharpen** (R), **Smudge** (R)                |              |
|          | Tone         | **Dodge** (O), **Burn** (O), **Sponge** (O)                  |              |
| Shapes   | Type         | **Text** (T)                                                 | yes          |
|          | Shape        | **Rectangle** (U), **Ellipse** (U), **Line** (U)             |              |

A group's letter takes its last used tool, Shift with it the next. Nowhere is there a long press: a group's other
tools are in its category and in its options' **Tool** section.

Pressing a shortcut takes that group's last used tool; Shift with it steps to the group's next tool. After the
groups sit the **colours**: the foreground swatch over and left of the background swatch, a small **swap** (X) and
**reset** (D, black over white). A press on a swatch opens the shared colour picker
([Colour picker](../004-interface-design/colour-picker.md)) for it; the picker's eyedropper samples the composite.
The person's colours and last tools are their own, kept in this browser.

A photo tool acts only on a photo page. With one in hand the pointer over any other page, or the bare canvas, is
the ordinary select pointer, and a press there leaves the photo tool in hand. Escape steps back one thing at a time:
what the tool has under way (a crop, a transform, a polygon), then the options flyout, then the selection, then the
tool itself, put down so the canvas has the press again.
Space held is the hand (pan), as everywhere; the canvas's own Select (the selection mode picker) puts every photo
tool down.

A **Participant** keeps their palette strip (the Participate category) with the Eyedropper and the colours added at
its end.

On a phone, whose strip shares its row with the menu, the photo tools are instead a single row at the bottom of the
screen above the safe area (the **tools row**): every group its own button, scrolling sideways with no scrollbar
drawn, beside **Layers**. A tap takes a tool; a tap on the tool in hand opens its options as a **bottom sheet** (the
options flyout's header and body: the Tool section, its sections, its presets). There is no options row and no quick
panel on a phone. While a crop or Free Transform is under way, a bar over the tools row holds its name, **Options**
(the sheet), **Cancel**, and **Crop** or **Commit**.

### The options flyout

The tool in hand's options, as a card in the palette's own flyout look ([Toolbar layout](../007-editor/toolbar-layout.md)
"The category bar"), 360 px wide, hanging from the tool's button in the palette strip (for a tool kept in a category, the category's button,
which holds it) with a small pointer up to it,
its left edge by the button's and held on screen, capped to the window's height (its body scrolls past that). It is
on the chrome surface, over the canvas, so the page never shifts for it.

- **Opening and closing**: pressing a tool's button (or picking one from its group) only takes the tool, the card shut;
  pressing the button of the tool already in hand (or its row in its category's flyout, or **All Options** on the quick
  panel) opens the card, and again closes it. A press on the photo (the tool's own press, which goes
  on to paint or select), anywhere else outside the card and the photo tools, Escape (which leaves the tool in hand)
  or putting the tool down closes it. A tool taken by its key leaves it as it was, so the keyboard never throws it
  over the photo. While a Free Transform or a crop box is open and the card is not, a small bar hangs there in its
  place: the tool's glyph and name, **Options** (opens the card), **Cancel**, and **Commit** (Free Transform) or
  **Crop**; a press outside the opened card folds it back to the bar while the box is still open.
- **Header**: the tool's glyph on a soft plate, its name and a line (up to two) saying how to use it, and **Reset**
  (the tool's options to their defaults).
- **Body**: the options ([Photo tools](photo-tools.md) names each tool's) in place, in titled sections with the
  flyout's rule: Selection, Tip, Type, Gradient, Crop, Sampling, Paint, Pen, then Behaviour for the on and off options
  with no section of their own (the Text tool's all under Type). A number is a row with its name, its value typed
  straight in and a slider filled to it (on a log scale when its range is a hundredfold or more, so a tip's 1 to
  2500 px gives the small sizes room); a tip's Size and Hardness have the tip drawn over them. A choice of up to five
  is tiles, each drawn as what it does (a selection mode as the two shapes it combines, a pen pressure as a stroke, a
  gradient's style as itself, a crop ratio as its box, a weight in its weight, a transform mode as the box it makes);
  the blend modes and fonts are a row opening a popover of their own (each blend mode a swatch the engine draws with
  its own maths, in their families). On and off options are switch rows with their line. After them, a brush tool's
  **Presets** (each saved tip drawn as its dab, the one in hand marked, and Save Preset), the Move tool's **Align**,
  and the Crop tool's Straighten, Cancel and Crop.
- **Free Transform**: Position (X, Y), Size (W, H, in px or as a percent) and Angle, Shape (Mode: Free, Skew,
  Perspective; Interpolation), Flip Horizontal and Flip Vertical, and Cancel and Commit.
- **Footer**: what the pointed-at control does (and its keys, such as `[` and `]` for Size), or a hint on how to use
  the tool and hide the card.

Each tool's options are the person's own, kept in this browser; a brush's size and hardness also change with `[` and
`]` (Shift for hardness). On a phone they are the bottom sheet the tools row opens.

### The quick panel

While a tool with numbers to set is in hand, a slim card (200 px) sits at the canvas's left (past the Contents
sidebar when it is docked there, never over it), under the top-left controls, with its main ones always in reach: the tool's glyph and name, **All Options** (opens the options flyout),
the tip drawn for a tool with one, and up to four quiet slider rows (the options flyout's slider row, smaller: the
value bare until pointed at, a thinner track), taken from the tool's options in the flyout's section order (a brush:
Size, Hardness, Opacity, Flow; a marquee: Feather; the Magic Wand: Tolerance). A tool with none (Move, Crop) shows no
panel. It steps aside while the options flyout is open (it holds the same settings), while a crop or transform is
under way, and on a phone. A slider moved with the pointer lets go of the focus, so the photo's keys work at once.

### The Photo panel

A **Photo** button joins the bottom-right cluster's pages strip, right after **Contents** in the same frame
([Pages](../007-editor/pages-mode.md) "Contents"), while a photo page is in focus for someone who may edit it or a
Participant. A press opens the Photo panel as a popover over it, 360 px wide (no taller than the room under the palette); it stays open while the photo is worked
on (a press outside it never closes it) until the button is pressed again or focus leaves the page. It has three tabs
as the shared segmented control:

- **Layers** ([Photo layers](photo-layers.md) "The Layers tab"): the layer stack, top layer first, with the blend
  mode, opacity and lock controls over it and the layer actions under it.
- **Adjust** ([Photo adjustments](photo-adjustments.md) "The Adjust tab"): the adjustments, as tiles; with an
  adjustment layer active, its properties.
- **History**: this person's edits to the photo this session as a timeline, newest at the bottom, each named
  ("Brush", "Levels", "New Layer") with its kind's glyph on the thread, the current one marked **Now**; a press on one undoes back to it (the later ones stay listed, dimmed, and a press on one of them
  redoes to it), and the next edit drops the dimmed ones. Up to the last 50 edits.

Above the tabs, always shown, a card: the **histogram** of the composite (worked out as the panel opens, then again a
moment after each change; luminosity, or the red, green and blue channels overlaid, a Luma / RGB switch on it), and
under it the photo's size and, while the pointer is over the photo, the pixel under it (`x, y`) and its colour as a
swatch with its `#rrggbb` (Point at the photo otherwise). On a phone it is a bottom
sheet opened by a **Layers** button at the end of the tools row.

### The title bar

A photo page's title bar holds, before its lock and cog, for someone who may edit, each the cog's size with a
tooltip and named beside its icon while there is room ([Pages](../007-editor/pages-mode.md) "Beside the cog"):

- **Image**: a menu: **Adjustments** (each adjustment, applied to the active layer, [Photo
  adjustments](photo-adjustments.md)), **Auto Tone**, **Auto Contrast**, **Auto Colour**, then **Image Size…**,
  **Canvas Size…**, **Rotate 90° Clockwise**, **Rotate 90° Anticlockwise**, **Rotate 180°**, **Rotate…**, **Flip
  Horizontal**, **Flip Vertical**, **Crop to Selection**, **Trim Transparent**, **Free Transform**, **Place
  Picture…**.
- **Select**: a menu: **All** (Ctrl/Cmd+A), **Deselect** (Ctrl/Cmd+D), **Reselect**, **Inverse**
  (Ctrl/Cmd+Shift+I), **Subject**, **Colour Range…**, **Select and Mask…**, then **Modify** (**Grow**, **Expand…**, **Contract…**,
  **Border…**, **Smooth…**, **Feather…**), and **Remove Background** ([Photo tools](photo-tools.md) "Smart
  selections").
- **Filter**: a menu of the filters by category, the last one used first as **Repeat <name>** (Ctrl/Cmd+Alt+F)
  ([Photo adjustments](photo-adjustments.md) "Filters").

The menus are the app's menu rows (icon left, full width, grouped with separators, Title Case), never tiles: every
row has its command's own glyph (an adjustment its own, a filter its category's, each category its own). Every
item is also in the command palette, prefixed `Photo:` ("Photo: Gaussian Blur"), while a photo page is in focus.

### Navigating

The canvas pans and zooms as everywhere; a photo page adds **Fit Photo** (Ctrl/Cmd+0: the page fills the view),
**Actual Pixels** (Ctrl/Cmd+1: one screen pixel per photo pixel, about the view's centre) and **zoom to the
pointer** with Alt and the wheel (as the wheel's zoom elsewhere), these keys while a photo tool is in hand. While a
photo page is in focus the zoom reaches past the canvas's usual 500% to 32 screen pixels a photo pixel, however
large the photo, and comes back within 500% when focus moves on. Past four screen pixels per photo pixel the
composite is drawn with hard pixel edges, and past eight a faint **pixel grid** shows (a view, toggled in the
View items of the command palette).

## Changing the size

All on the active photo, each one edit:

- **Image Size…** (dialog): width and height in pixels or percent, a chain keeping the shape (on by default), and
  **Resample**: **Bicubic** (the default, best for photos), **Bilinear**, **Nearest Neighbour** (hard edges, for
  pixel art). Every layer and mask is resampled; text layers keep their text and scale their size. The page's
  sheet takes the new shape.
- **Canvas Size…** (dialog): new width and height, an **Anchor** grid of nine (where the existing pixels sit), and
  the colour new pixels on the bottom layer take (**Transparent**, **White**, **Background Colour**). Layers keep
  their pixels; the photo grows or crops around them.
- **Rotate** (90° steps, 180°, or **Rotate…** any angle with the canvas growing to fit) and **Flip** turn every
  layer together. A text layer stays upright and editable: its box moves so its centre stays on the same part of
  the picture.
- **Crop to Selection** crops to the selection's bounds; **Trim Transparent** crops to the composite's
  non-transparent bounds. The **Crop** tool ([Photo tools](photo-tools.md) "Crop") is the hands-on way.
- A size past the pixel cap is refused, with a toast: "Photos can be up to 8192 px on a side." (4096 on a phone).

## Share roles

| Role            | On a photo page                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Everything: every tool, every layer change, adjustments, filters, size changes, making and deleting photo pages.                                                                                                                                |
| **Participant** | Sees the photo and the layer stack (read-only Layers tab: no actions, no toggles), may use the Eyedropper and the info line, and may add elements on top where they may add content. No tool that changes pixels or layers, no title-bar menus. |
| **Viewer**      | Sees the photo; no photo tools, no options flyout, no panel; may export where the design allows exports.                                                                                                                                        |

The server refuses a photo blob write from anyone who may not edit the tab, and the room refuses a `photo` op from
a Participant or a Viewer.

## Collaboration

- The photo, its layer stack and every layer's settings are the tab's and sync to everyone, layer by layer
  ([Photo store](photo-store.md) "Live sync"): two people changing different layers both keep their changes; two
  changing the same layer, the later commit wins.
- A stroke, a fill or a filter is committed when it ends (the pointer up, the dialog's OK); others see it within
  about a second of the commit, as soon as its pixels have been sent. While it is in progress only its author sees
  it.
- The **active layer**, the **selection**, the **colours**, the tool in hand and its options are each person's own.
  The Layers tab marks a layer someone else is on with their avatar (up to three, then `+n`), from their presence:
  someone who may edit the photo in focus says their active layer as an ephemeral `photo-presence` room op
  (`{ tabId, pageId, layerId | null }`, never stored, said again to a late joiner and after a rejoin), and a
  person who leaves takes their avatar with them.
- A change someone else commits to a layer this person is still working on (a stroke, a floating selection, an
  unfinished transform, a commit not yet sent) shows at once wherever this person has not touched it; on the tiles
  this person's unfinished change touches, theirs waits, and this person's commit, the later, wins them. If this
  person cancels instead (Escape), the other person's change shows there.

## Exports and other views

- **The composite is the page.** Every export of the page (PNG, JPEG, PDF, the page images, presenting,
  share-link previews, the Explorer thumbnail) draws the composite at the page's place, then the
  elements on top. The PNG of a photo page is exported at its **pixel size** by default (Export's scale **Actual
  Pixels**), and offers the usual scales beside it.
- **Photo export** (the Export dialog's **Photo** card, while the tab has a photo page): which photo page, then
  **Format**: **PNG**, **JPEG** (quality 1 to 100, 90 by default, on a background of white or the background
  colour where transparent), **WebP** (quality, or **Lossless**), or **PSD** (layers kept: pixel layers with their
  names, opacity, blend modes, visibility and masks; adjustment, fill and text layers as pixel layers named after
  them, so the file looks the same in another editor). **Layers as Files** downloads a .zip of each visible layer as a
  PNG the photo's size. Elements on top are included in PNG, JPEG and WebP (**Include Elements**, on by default) and
  never in PSD.
- **Opening a PSD**: a .psd file is accepted wherever a picture starts a photo (Open a Picture's Upload, a drop, a
  paste). Its layers come in as pixel layers with their names, opacity, blend modes, visibility, masks, clipping and
  groups; text and effects as their pixels. A PSD in 16 or 32 bits per channel, CMYK, or past the pixel cap is
  refused with a toast naming why.
- **Server-made views** (the Explorer thumbnail, a share link's live image, an agent's preview) draw the photo's
  **preview**: a flattened copy no larger than 2048 px, kept beside its pixels ([Photo store](photo-store.md)
  "Previews"). A photo whose preview is not yet made draws the checkerboard with a picture glyph.

## Agents

- An agent reads a photo page as a page: `read_design`'s pages view names its kind, pixel size and layers (each
  layer's name, kind, visibility, opacity and blend mode), and the preview shows its composite.
- An agent may add a photo page (`change_pages` `{ "op": "add", "kind": "photo" }`, an empty transparent 1920 x
  1080 photo, or with `width` and `height`), rename one and delete one. It may not change pixels or layers: an
  agent write that would change a photo's layers is refused, naming the photo page ("Photo pages are edited in the
  editor: their layers can't be changed by an agent.").
- Every agent write keeps the tab's photos as they are.

## Limits

- **Pixel cap**: 8192 px a side on a desktop, 4096 on a phone or tablet, and at most 40 million pixels in all. A
  picture opened past it is scaled down to fit, with a toast saying so.
- **Layers**: at most 100 a photo; **Photo pages**: at most 10 a tab (photos are heavy).
- **Memory**: only the photo page in focus holds its layers' pixels; every other photo page shows its preview. A
  phone holds at most one photo's pixels at a time.
- **Undo** covers the last 50 photo edits of this session ([Photo store](photo-store.md) "Undo").

## Telemetry

`Tab · Changed ·` `PhotoPageAdded`, `PageKindPhoto` (the first page's choice), `PhotoStartedFromPicture`,
`PhotoStartedBlank`, `PhotoEditAsPhoto`, `PhotoImageSize`, `PhotoCanvasSize`, `PhotoRotated`, `PhotoFlipped`,
`PhotoCropped`, `PhotoTrimmed`; `Element · Used ·` each tool once per stroke or use (`PhotoBrush`, `PhotoEraser`,
... the tool's id in Pascal case); `Element · Changed ·` each adjustment and filter applied (`PhotoAdjust<Id>`,
`PhotoFilter<Id>`), each layer operation (`PhotoLayer<Operation>`); `Design · Exported · Photo<Format>`,
`Design · Imported · PhotoPsd`; `UI · Opened · PhotoPanel<Tab>`. Never a colour, a size, a name or text.

## Non-goals

- 16 or 32 bits per channel, CMYK, colour profiles (everything is sRGB, 8 bits a channel), RAW camera files.
- Vector shape layers and paths (elements on top are the vectors), smart objects, artboards within a photo, 3D,
  video and animation frames.
- Generative fill, or any tool that needs a model download or a paid service: the smart tools are classical
  ([Photo tools](photo-tools.md) "Smart selections").
- Live, stroke-by-stroke sharing of painting; layer locks held for a person.
- Agents editing pixels.
