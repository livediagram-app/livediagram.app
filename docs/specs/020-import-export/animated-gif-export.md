# Animated GIF export

An Illustrate tab's pages exported as one **animated GIF**: each page held for a set time, one after another, with
the deck's transition between them, looping forever. Everything that moves on a page moves in the GIF: an animated
background ([Illustrate pages](../007-editor/illustrate-pages.md) "Animated backgrounds") and every element
animation ([Element animations](../028-animation/element-animations.md)) run as they run on the canvas. A GIF plays
anywhere an image does (a chat message, an email, a README, a social post), which a deck does not.

## Where it is offered

- **Illustrate mode only.** The Export dialog's Illustrate formats ([Illustrate pages](../007-editor/illustrate-pages.md)
  "Export") gain a **GIF** card after SVG: PDF, PNG, SVG, GIF, JSON (then Logo Kit while the tab has a logo page).
  Outside Illustrate the card is never shown.
- Card copy: **GIF**, "An animated image of the pages, moving as they move on the canvas."
- Every page kind exports: slides, infographic, article and logo pages. A logo page's see-through paper exports white
  (GIF transparency is one bit and would fringe every soft edge).
- **Share roles**: as every Export dialog format. Whoever can open the Export dialog (an Editor, a Participant and a
  Viewer alike) can export a GIF; it reads the tab and changes nothing.

## The options

The GIF card opens an options-and-download panel, like PNG's, with the shared back bar. The dialog's subtitle reads
"Set how the pages play, then download the GIF."

- **Pages**: the **All pages** / **One page** control every page format uses, starting on **All pages**. With One
  page, which page, by its label. The line under it says what the download is: "One GIF of the 3 pages in turn,
  looping." (All pages with two or more), otherwise "One GIF of the page, looping."
- **Each page holds**: one slider for every page, **1 to 20 seconds** in half-second steps, reading its value
  ("3 s"). It starts at the deck's **Auto-advance** interval when that is on (clamped to the range), otherwise
  **3 seconds**. The hold is the page's whole time in the GIF, its transition included.
- **Size**: a segmented control, **Small**, **Medium**, **Large**: the page's longer side at **480**, **960** or
  **1440** px, the other side in proportion. Starts on **Medium**. Every frame of a GIF is the picked page's size;
  with All pages, a page of another shape (a 4:3 slide in a 16:9 deck, a portrait infographic) is fitted inside it,
  centred on white, never cropped.
- **Between pages** (All pages with two or more pages): a one-line note naming the deck's transition and speed, as
  the Slide Deck settings hold them ("Between pages: Fade, Normal, from the Slide Deck settings."; with None, "Between
  pages: None, from the Slide Deck settings."), so the GIF moves between pages as presenting does. It is not changed
  here.
- **Estimated size**: "About 3.4 MB", worked out from a sample frame of the chosen pages at the chosen size, and
  updated as the options change. Above **15 MB** it goes on "About 20.0 MB. Large for chat and email: try Small or a
  shorter hold."
- The **preview** shows the chosen page (with All pages, the page picked to preview) as it opens, still, drawn the
  way the GIF's frames are (on white). "Preparing preview…" shows until it is ready.
- **Download GIF** makes the file. While it is made the button reads **Making GIF… 42%** beside a progress bar, a
  **Cancel** button stops it, and the dialog's options are disabled. The download is named
  `<document> - <tab>.gif`, or with ` - <page label>` for One page.

## The timeline

- **Frame rate**: 15 frames a second.
- **All pages**: the pages in order, each for its hold, then back to the first, looping forever. A page's clock
  starts at zero as it comes in, so a reveal plays in and a play-once animation plays from its start every time the
  page comes round, as when a slide opens while presenting; looping animations run on from there.
- **Transitions** take the first part of each page's hold, the incoming page's clock running from its start:
  - **Slide**: the outgoing page travels out to the left as the incoming page travels in from the right.
  - **Fade**: the outgoing page dissolves into the incoming one.
  - **None**: a cut.
  - The duration is the deck's speed (Quick 220 ms, Normal 380 ms, Slow 620 ms), with the presenting easing.
  - The loop from the last page back to the first has the same transition, so the GIF has no seam.
- **One page**: that page for its hold, then from its start again. No transition.
- **A still page** (nothing on it moves) is one frame held for its hold, so a still page costs one frame, not
  forty-five. Consecutive frames that come out identical are merged into one longer frame.
- **Longest GIF**: **3 minutes** in all (the holds added up). Past it, Download is disabled and the panel says
  "Too long for a GIF: keep it under 3 minutes by shortening the hold or exporting one page."

## What a frame shows

- **Exactly what the page shows on the canvas** at that moment of its clock: its paper, background (an animated
  background mid-motion), pattern, picture, writing and every element on it, clipped to its edges, inked for its
  surface. It is drawn from the canvas's own rendering, not the image exporter's, so an element animates in the GIF
  exactly as it does on the canvas.
- **Never** what is only the editor's: a selection, grips, hover, cursors and remote presence, comment pins, page
  headers and toolbars, the in-page **Start From a Layout** card, the laser. The panel clears the person's own
  selection as it opens, so no element is ringed; a collaborator's selection colour is drawn into the element itself
  on the canvas, so it shows in the GIF while it lasts (a known gap).
- **Fonts and images travel in the file**, as in every image export.
- **Reduce Motion** never stills the GIF: the file is made to move, and it plays on screens that are not the
  exporter's. The panel's preview, which is still, is unaffected.
- **What cannot be sampled shows still**: a video shows its poster, an animated GIF image its first frame, and a
  web embed its placeholder, as in a PNG export.
- **Colours hold still**: a GIF frame has at most 256 colours. Every frame of a page shares one set, chosen from
  across the page's hold, so a slowly drifting gradient (an aurora, bokeh) drifts calmly instead of its colour bands
  jumping from frame to frame, and a colour always comes out as the same one of the 256. A transition frame, where
  two pages mix, takes its own set. Gradients are not dithered: it smooths their faint steps but makes the file
  about 70% bigger.

## Errors

- **The browser will not draw the page** (it refuses to read back a drawn frame): "This browser couldn't draw the
  page into a GIF. Try Chrome, Edge or Firefox, or export a PNG." The GIF card stays; nothing downloads.
- **The page is not on the canvas** (it was deleted while the dialog was open): "That page is no longer in the
  tab." The page picker drops it.
- **Out of memory or any other failure**: "Couldn't make the GIF. Try a smaller size or a shorter hold."
- **Cancel** discards everything made so far; nothing downloads.

## Telemetry

`Document · Exported · IllustrateGIF` (one page) and `IllustrateGIFPages` (all pages), as the other page formats
([Illustrate pages](../007-editor/illustrate-pages.md) "Telemetry"). Never a page name, size in bytes or hold.

## Non-goals

- A hold per page: one hold applies to every page.
- A transition chosen in the export: the deck's own transition is used.
- Frame rate or colour count options; video formats (MP4, WebM); a GIF of a diagram tab.
