# Photo adjustments and filters

**Adjustments** change a picture's colours and tones, pixel by pixel, without moving anything: as an
**adjustment layer** (non-destructive, changing everything under it, editable for ever) or **applied** to the active
pixel layer (the Image menu's Adjustments). **Filters** change pixels from their neighbours (blurs, sharpening,
noise, distortions): always applied to the active pixel layer, within the selection.

## Domain language

| Term                 | Means                                                                     | Never called |
| -------------------- | ------------------------------------------------------------------------- | ------------ |
| **adjustment**       | One of the catalogue below with its settings (`PhotoAdjustment`).         | effect, tune |
| **adjustment layer** | A layer of kind `adjustment` ([Photo layers](photo-layers.md)).           | filter layer |
| **filter**           | A neighbourhood change applied to pixels, from the Filter menu.           | effect       |
| **preview**          | The photo shown with the dialog's current settings before OK.             | proof        |
| **channel**          | Red, green or blue, or **RGB** (all three together) in Levels and Curves. | band         |

## The Adjust tab

The Photo panel's **Adjust** tab ([Photo pages](photo-pages.md) "The Photo panel"):

- **Tiles**, three a row in sections (**Light**: Brightness/Contrast, Levels, Curves, Exposure; **Colour**:
  Vibrance, Hue/Saturation, Colour Balance, White Balance, Photo Filter, Selective Colour, Channel Mixer;
  **Creative**: Black & White, Gradient Map, Invert, Posterize, Threshold), each the photo itself through that
  adjustment (made small from the preview-sized composite, at once and again a moment after each change, with
  settings that show it plainly, since most start as no change) over its name, its line on hover. A press adds an
  adjustment layer of it (at its own defaults) above the active layer (clipped to it when Alt is held), masked by
  the selection when there is one, and opens its properties. A line under the tiles says so.
- **Properties**: while an adjustment layer is active the tab shows its settings over the tiles' place: **All
  Adjustments** (back to the tiles, the layer still active), a header with its picture, name, line and **Reset**,
  the settings, and **Clip to Layer Below** (a switch). Each change previews at once on the photo and commits
  (one edit) half a second after the last change, or as a slider is let go.
- An **applied** adjustment (the Image menu) opens the same settings in a dialog, previewing on the active layer
  within the selection, with **Preview** (on), **Reset**, **Cancel** and **OK** (one edit).

## The adjustments

Each with its settings and their defaults (the default leaves the picture as it is unless named):

| Id                   | Name                | Settings                                                                                                                                                                       |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `brightness`         | Brightness/Contrast | Brightness -150 to 150, Contrast -50 to 100                                                                                                                                    |
| `levels`             | Levels              | Per channel (RGB, Red, Green, Blue): input black 0 to 253, input white 2 to 255, gamma 0.1 to 9.99, output black and white 0 to 255; **Auto**; the histogram under the sliders |
| `curves`             | Curves              | Per channel: 2 to 16 points (input, output 0 to 255) joined by a smooth monotone curve; **Auto**; points added by a press, removed by dragging off                             |
| `exposure`           | Exposure            | Exposure -20 to 20 stops, Offset -0.5 to 0.5, Gamma 0.01 to 9.99                                                                                                               |
| `vibrance`           | Vibrance            | Vibrance -100 to 100, Saturation -100 to 100                                                                                                                                   |
| `hue-saturation`     | Hue/Saturation      | Hue -180 to 180, Saturation -100 to 100, Lightness -100 to 100, per range (Master, Reds, Yellows, Greens, Cyans, Blues, Magentas), **Colourise**                               |
| `colour-balance`     | Colour Balance      | For Shadows, Midtones and Highlights: Cyan–Red, Magenta–Green, Yellow–Blue each -100 to 100; **Preserve Luminosity** (on)                                                      |
| `white-balance`      | White Balance       | Temperature -100 to 100, Tint -100 to 100, and a picker: press something that should be neutral grey                                                                           |
| `black-white`        | Black & White       | Reds 40, Yellows 60, Greens 40, Cyans 60, Blues 20, Magentas 80 (each -200 to 300%); **Tint** with a colour                                                                    |
| `photo-filter`       | Photo Filter        | Filter (Warming 85, Warming LBA, Cooling 80, Cooling LBB, Sepia, and a colour), Density 1 to 100% (25), **Preserve Luminosity** (on)                                           |
| `channel-mixer`      | Channel Mixer       | For each output channel: Red, Green, Blue -200 to 200%, Constant -200 to 200%; **Monochrome**                                                                                  |
| `selective-colour`   | Selective Colour    | For Reds, Yellows, Greens, Cyans, Blues, Magentas, Whites, Neutrals, Blacks: Cyan, Magenta, Yellow, Black -100 to 100%; **Relative** or **Absolute**                           |
| `gradient-map`       | Gradient Map        | A gradient (as the Gradient tool's) mapping dark to light; **Reverse**, **Dither**                                                                                             |
| `invert`             | Invert              | None                                                                                                                                                                           |
| `posterize`          | Posterize           | Levels 2 to 255 (4)                                                                                                                                                            |
| `threshold`          | Threshold           | Level 1 to 255 (128), the histogram under it                                                                                                                                   |
| `shadows-highlights` | Shadows/Highlights  | Shadows 0 to 100% (35), Highlights 0 to 100% (0), Radius 0 to 250 px (30): applied only (it reads neighbours), not as a layer                                                  |
| `desaturate`         | Desaturate          | None (Image menu only)                                                                                                                                                         |
| `equalize`           | Equalize            | None (Image menu only): spreads the luminosity evenly                                                                                                                          |

**Auto Tone** (Levels per channel, clipping 0.1% each end), **Auto Contrast** (Levels on luminosity, colours
kept) and **Auto Colour** (Auto Tone, then neutral midtones) are applied adjustments, each one press in the Image
menu, and the **Auto** of Levels and Curves fills their settings the same way.

Formulas: as the [blueprint](blueprints/photo-engine.md) states, each defined on 8-bit sRGB values; hue,
saturation and luminosity on the HSL and Rec. 601 luma the blend modes use; every adjustment is a lookup table
where it is per channel (Levels, Curves, Exposure, Posterize, Threshold, Invert, Brightness/Contrast), so it is
exact and fast at any size.

## Filters

The Filter menu, by category; each opens its dialog with a live preview on the photo (in the selection), a smaller
preview square at 100% inside the dialog you can drag to look around, and **OK** (one edit). Applied in the
background, with a progress bar on the dialog for anything past half a second, and **Cancel** while it runs.

- **Blur**: **Gaussian Blur** (Radius 0.1 to 250 px), **Box Blur** (Radius 1 to 250), **Motion Blur** (Angle,
  Distance 1 to 999 px), **Radial Blur** (Amount, **Spin** or **Zoom**, its centre placed on the preview), **Surface
  Blur** (Radius 1 to 100, Threshold 2 to 255: smooths and keeps edges), **Lens Blur** (Radius, Blade curvature as
  a round bokeh, **Brightness** of highlights), **Tilt-Shift** (a band in focus, its angle and blur).
- **Sharpen**: **Unsharp Mask** (Amount 1 to 500%, Radius 0.1 to 250 px, Threshold 0 to 255), **Sharpen** and
  **Sharpen More** (no settings), **High Pass** (Radius: the detail alone over grey, for an Overlay layer).
- **Noise**: **Add Noise** (Amount 0.1 to 400%, **Uniform** or **Gaussian**, **Monochromatic**), **Reduce Noise**
  (Strength 0 to 10, Preserve Details 0 to 100%, Reduce Colour Noise 0 to 100%), **Median** (Radius 1 to 100),
  **Despeckle** (none), **Dust & Scratches** (Radius, Threshold).
- **Stylize**: **Emboss** (Angle, Height, Amount), **Find Edges** (none), **Oil Paint** (Stylization, Cleanliness:
  a Kuwahara smoothing), **Solarize** (none), **Glowing Edges** (Width, Brightness, Smoothness), **Diffuse** (Normal,
  Darken Only, Lighten Only).
- **Pixelate**: **Mosaic** (Cell 2 to 200 px), **Crystallize** (Cell 3 to 300 px), **Colour Halftone** (Max
  radius, the four screen angles), **Pointillize** (Cell).
- **Distort**: **Pinch** (-100 to 100%), **Twirl** (Angle -999 to 999°), **Spherize** (-100 to 100%), **Wave**
  (Wavelength, Amplitude, horizontal and vertical), **Ripple** (Amount, Small/Medium/Large), **Polar Coordinates**
  (Rectangular to Polar and back), **Lens Correction** (Distortion -100 to 100, Vignette, Chromatic aberration red–
  cyan and blue–yellow).
- **Render**: **Clouds** (from the colours), **Difference Clouds**, **Vignette** (Amount -100 to 100, Midpoint,
  Roundness, Feather), **Lens Flare** (Brightness, a centre placed on the preview, three lens types).
- **Enhance**: **Clarity** (-100 to 100: local midtone contrast), **Dehaze** (-100 to 100: dark-channel haze
  removal), **Grain** (Amount, Size, Roughness).
- **Other**: **Offset** (Horizontal and Vertical px, **Wrap Around**, **Repeat Edge** or **Transparent**),
  **Maximum** and **Minimum** (Radius), **Custom** (a 5 x 5 kernel, Scale, Offset).

A filter on a layer with transparency treats the edge as its own pixels repeated, never as black. A filter needs a
pixel layer: on a text or fill layer it offers to **Rasterize and Apply**.

## Performance

- Every adjustment previews at interactive speed on a 12-megapixel photo: the layer's look is computed on the GPU
  where the editor has one (WebGL 2), and on the CPU in a worker otherwise.
- A filter's live preview is drawn on the visible part of the photo at the screen's resolution, and on the whole
  layer only at OK.
- Filters run in a worker; the editor stays responsive. Each has a budget (the
  [blueprint](blueprints/photo-engine.md) lists them), held by tests on a 4096 x 4096 layer.

## Non-goals

- Smart filters (filters kept live on a layer), Liquify, Camera Raw, Puppet Warp, Vanishing Point, 3D, filter
  galleries of artistic effects past those listed.
