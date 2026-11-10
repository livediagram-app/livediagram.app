# The logo strip

## What

A **Logo Strip**: a row of customer or partner logos, evenly spaced and the same height, for a "Trusted by" slide or
the foot of a poster. It is a [stack](stack.md) holding [image elements](images.md), so every logo is an ordinary
picture (uploaded, picked from the gallery or found by Image search) and the stack keeps them in line as logos are
added, removed or reordered.

## Why

Nearly every pitch, sales and conference deck has a logo slide, and lining up six logos of different shapes by hand
is fiddly: they end up at different heights with uneven gaps, and the first logo added undoes it. Logos also clash in
colour; a quiet greyscale row reads as one block and keeps the slide's own colours in charge.

## What it is made of

- **The strip**: a stack (`shape: 'stack'`), a row, its children centred, a 40 px gap and 16 px padding, with no
  border and no fill, so only the logos show, on screen and in every export. Its title (the stack's label) is empty.
- **The logos**: five image elements, each a 160 x 64 box showing its picture whole (`objectFit: 'contain'`, so a
  wide wordmark and a square badge both fit without cropping), `greyscale: true`, aspect lock off (a box keeps the
  height of its neighbours whatever the picture's shape), alt text "Logo" until a picture brings its own name.
  Each starts as an image placeholder with its Select Image button.
- Because it is a stack, a logo dropped onto the strip takes a slot, one dragged out leaves it, one dragged past
  another swaps places, and the strip grows and shrinks to hug them (all as [The stack](stack.md) says).

## Making one

- **Palette**: **Logo Strip** in the **Media** category, after the Avatar ("A row of customer or partner logos, evenly
  spaced"). Like the other components it arms the draw gesture: a tap drops the strip at its natural size centred on
  the tap; a drag sizes it, the five logos sharing the dragged width (each at least 48 x 24) and taking its height.
- **Slide layout**: **Logo Strip** in the **Content** slide layouts ([Pages](../007-editor/pages-mode.md) "Slide
  layouts"): an eyebrow ("Trusted by"), a title ("Teams everywhere build with us"), a line under it, and a strip of six
  logos across the slide's width, each a sixth of it less the gaps, centred in the lower half.
- **Agents** make one as a stack holding image elements with `greyscale` ([Picture crop, mask and
  greyscale](picture-crop-and-mask.md) "Agents").

## The Greyscale toggle

A stack holding at least one picture has **Greyscale Pictures** in its Stack section ("Draw every picture in it in
shades of grey."): on while every picture it holds is greyscale. A press turns greyscale on (or off) for every image
the stack directly holds, one edit; a single logo can still be changed on its own from its Image section.

## Share roles

| Role        | May                                                                                  |
| ----------- | ------------------------------------------------------------------------------------ |
| Editor      | Everything above                                                                     |
| Participant | Look; write a logo's alt text as for any image; never adds, moves or restyles a logo |
| Viewer      | Look                                                                                 |

## Telemetry

Placing one tracks `Element · Added · LogoStrip`; the Greyscale Pictures toggle `Element · Changed · ImageGreyscale`.
