# Experiments, group H: recall, round 3

Part of [the experiment plan](../../../plans/event-storming-photo-95-experiments.md)
towards [the bar](../../../plans/event-storming-photo-95.md), after round 2's
[no-box group](f-nobox.md) and [colour group](a2-colour.md). Owned files:
`boxes.ts`, `detect.ts`, `classify.ts`, `floors.ts`, `lab.ts`, `colour.ts`.
Target: recall without actors ≥ 95% on every wall.

Every number is from `npx tsx scripts/calibrate.ts` on the eight labelled walls
(645 notes), scored on the editor's own pixels. Per-wall cells read
**F1 / precision / recall without actors / merged boxes**.

## Baseline (commit `71bb6eed`)

TOTAL F1 90.7%, precision 93%, recall 88%, merged 29, 1/8 walls pass (201707).

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 85 / 82 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0 PASS      |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 80 / 88 / 77 / 10          |
| whiteboard-dense | 93 / 96 / 89 / 11          |

What the misses are (`scripts/merged.ts`, `scripts/nobox.ts`), and what each
wall needs to reach 95% without actors:

| wall             | needs | paper-no-box                                        | in-other-box | in-merged (I) |
| ---------------- | ----- | --------------------------------------------------- | ------------ | ------------- |
| 201646           | +1    | 1 (a note welded to kraft the floors call paper)    | 2            | 0             |
| 201707           | 0     | 2 (a flush cluster cut on the grid)                 | 0            | 0             |
| 201713           | +1    | 1 (the same cluster, second photo)                  | 1            | 0             |
| 201730 (shade)   | +2    | 2 (a pink note in deep shade, a note 60% covered)   | 0            | 2             |
| 201743 (night)   | +8    | 7 (five 15px notes in the window, a slanted column) | 0            | 1             |
| wall-panorama    | +9    | 4                                                   | 2            | 13            |
| whiteboard-dense | +16   | 12 (five pale notes under `standout`, partials)     | 1            | 9             |

The night wall's two remaining misses beyond those seven are duplicate labels
(`merged.ts`: inseparable); until the operator fixes them its ceiling is
37 of 39, 94.9%.

## H1: the close at one pixel (kept)

**Finding.** Lowering the at-hue CIELAB test for off-hue pixels (see H2) moved
201713 from 94% to 100% recall without actors; the class mask in its flush
cluster did not change by one pixel. What changed was the note size, 38 → 37px,
and with it the close radius, `round(0.04 × 38)` = 2 → `round(0.04 × 37)` = 1.
The close was sitting on a knife edge.

**Hypothesis.** A two-pixel close bridges the thin shadow line between flush
notes, and the gap between a note and a patch of kraft the floors call paper,
so runs come out that the splitter then cuts where its grid falls. One pixel
still repairs handwriting at the working size.

| `CLOSE_NOTE_FRACTION` | TOTAL | merged | walls | 201646     | 201707      | 201713      | 201743     |
| --------------------- | ----- | ------ | ----- | ---------- | ----------- | ----------- | ---------- |
| no close (radius 0)   | 88.1  | 36     | 1/8   | 79/79/83/4 | 77/85/71/2  | 98/100/96/0 | 81/86/74/2 |
| 0.015, 0.02, 0.025    | 91.5  | 29     | 2/8   | 88/86/95/1 | 98/95/100/0 | 99/100/98/0 | 81/84/77/2 |
| 0.03                  | 91.3  | 29     | 2/8   | 85/82/93/1 | 98/95/100/0 | 99/100/98/0 | 81/84/77/2 |
| 0.035                 | 91.1  | 29     | 2/8   | 85/82/93/1 | 95/95/95/0  | 99/100/98/0 | 81/84/77/2 |
| 0.04 (before)         | 90.7  | 29     | 1/8   | 85/82/93/1 | 95/95/95/0  | 95/96/94/0  | 80/82/77/2 |
| 0.045                 | 90.7  | 29     | 1/8   | 85/82/93/1 | 95/95/95/0  | 95/96/94/0  | 80/82/77/2 |

Every fraction from 0.01 to 0.029 gives a one-pixel close on every labelled
wall (notes 19 to 51px) and scores the same; from 0.03 the 51px notes of 201646
get two pixels again and lose the note welded to kraft. No close at all is far
worse (88.1): handwriting then shatters notes. 0.02 sits in the middle.

What it finds: 201646's orange legend note (no longer welded to the lit kraft
above it) and two cardboard boxes fewer; the two cluster notes 201707 missed
and two of 201713's. No wall loses a note.

| wall             | before            | after             |
| ---------------- | ----------------- | ----------------- |
| 201646           | 85 / 82 / 93 / 1  | 88 / 86 / 95 / 1  |
| 201654           | 99 / 100 / 98 / 3 | 99 / 100 / 98 / 3 |
| 201707           | 95 / 95 / 95 / 0  | 98 / 95 / 100 / 0 |
| 201713           | 95 / 96 / 94 / 0  | 99 / 100 / 98 / 0 |
| 201730 (shade)   | 93 / 94 / 92 / 2  | 93 / 94 / 92 / 2  |
| 201743 (night)   | 80 / 82 / 77 / 2  | 81 / 84 / 77 / 2  |
| wall-panorama    | 80 / 88 / 77 / 10 | 80 / 88 / 77 / 10 |
| whiteboard-dense | 93 / 96 / 89 / 11 | 93 / 96 / 89 / 11 |
| **TOTAL**        | 90.7, 29, 1/8     | **91.5, 29, 2/8** |

A synthetic wall (flush 48px notes, strokes 2 to 5px, gaps 2 to 6px) cannot
tell the two radii apart: each fails only where a stroke is wider than the gap
between notes, at its own scale. The gain is in how real paper edges are
photographed, which is why the guard test pins the rule (a one-pixel close for
the working size's notes) rather than a drawing.

## H2: a column of narrow notes, counted by its own proportion (kept)

**Finding.** The night wall's slanted left column is two narrow notes end to
end, 28×56 and 26×51 lapped by a few pixels, one component 24×111 with no seam
in either mask. The length rule counts it by the wall's 41px note (2.7 notes)
and cuts three 24×37 slivers, each under the size floor; the rescue finds
nothing. As a single box it is refused for its aspect (4.6).

**Hypothesis.** A narrow note is about twice as long as it is thick (the
labelled ones 1.8 to 2.1). A whole box whose pieces, counted by that
proportion, are each a narrow note (F1's test: half a note thick, 0.9 of one
long, one note by the raw-mask seam) is a run of them.

**Rule** (`cutNarrowRun`, `narrow.ts`). Tried after the pieces and the parts
have failed and before the rescue: `round(long / (2 × short))` pieces, two to
four, cut evenly; every piece must be a narrow note and paper by the ordinary
filters, or the box goes on to the rescue as before.

| variant                                   | TOTAL | 201743 night | wall-panorama |
| ----------------------------------------- | ----- | ------------ | ------------- |
| before                                    | 91.5  | 81/84/77/2   | 80/88/77/10   |
| run judged by its colour's note size      | 91.5  | 83/83/82/2   | 79/86/77/10   |
| run judged by the wall's note size (kept) | 91.6  | 83/83/82/2   | 80/88/77/10   |

By its colour's size the panorama's small-pad floor let a strip of tape 14px
thick through as two "narrow notes"; half a small note thick is tape, so the
run is judged against the wall's note. The one box it adds that is not a note
is a strip of lit kraft beside the night wall's racket handle (26×106, fill
0.62; the column is 0.71): no feature of its own tells it apart.

| `NARROW_RUN_ASPECT` | 1.7  | 1.85 | 2 (kept) | 2.15 | 2.3  |
| ------------------- | ---- | ---- | -------- | ---- | ---- |
| TOTAL               | 91.5 | 91.6 | 91.6     | 91.6 | 91.6 |
| night rec-A         | 77   | 82   | 82       | 82   | 82   |

At 1.7 the column counts as three again. Night +2 notes (77 → 82 rec-A),
+1 junk; no other wall moves.

## H3: a pad note whose only sibling is a fused note (kept)

**Finding.** The night wall's far board has one pink note (13×12) among its
orange ones. It is refused by the area gate and offered to `findPads` as a
seed, but its only sibling within reach is a square cut out of a fused row of
three: the seeds alone link it to nobody, and the cut squares joined the pad
one after another while seeds left out were never looked at again.

**Rule.** The growth loop that lets fused squares join a pad, sibling after
sibling, takes the seeds left out of every pad too (same size match,
`FUSED_SIZE_RATIO`). A lone seed still makes no pad of its own.

| wall           | before     | after      |
| -------------- | ---------- | ---------- |
| 201743 (night) | 83/83/82/2 | 84/83/85/2 |
| **TOTAL**      | 91.6       | **91.7**   |

No other wall moves. `FUSED_SIZE_RATIO` 1.3 / 1.5 / 1.7 / 1.9: 91.7 / 91.7 /
91.6 / 91.6. Letting pad seeds be less square (`PAD_MAX_ASPECT` 1.6: no change;
1.7: 91.5, 201713 loses its PASS to a spurious box) finds none of the partial
window notes (9×14 on a 15px note), and is not kept.

## H4: two shades of one kind are two papers (kept)

**Finding.** `merged.ts` lists three notes that sit in some OTHER box: a
wide note cut in half (201646's 93×56 "if … or …" note, the panorama's 65×35
and 55×32). On 201646 the wide note is a pale periwinkle the operator labels
a command (`scripts/h-kindhue.ts`: h 243, saturation 0.24), lapped against a
vivid blue command (h 196, saturation 0.97). One mask class, one blob 140×56,
which the length rule cuts by the wall's note into three 47px slivers. The
same pair of papers is on 201654, 201707 and 201713; the panorama and the
whiteboard have pale and vivid pinks side by side.

**Hypothesis.** A pale and a vivid paper of one kind are different
stationery: given a mask class each, the components come apart where the
paper changes, and each shade is measured and cut as itself. Both read back
as the same kind.

**Rule** (`isPaleShade`, `classify.ts`; ids after the kinds in
`detect.ts`). A pixel of a kind that has a pale shade is that shade when its
saturation is under a line and it is lit (value at least 0.6).

First measured for blue alone, without the value test: the night wall
collapses (84 → 62 F1). Its room is full of dim blue-grey, which as a class
of its own makes note-sized blobs and moves the wall's note size with them
(orange notes are lost). Measuring the note size on the kinds instead of the
shades repairs it (91.9 / 29); so does the value test, which keeps a vivid
note's shade and the dim room out of the pale class (91.9 / 27). The value
test alone is kept: one rule, not two.

| pale shades for   | saturation line | value | TOTAL / merged |
| ----------------- | --------------- | ----- | -------------- |
| blue              | 0.35–0.45       | 0.6   | 91.9 / 27      |
| blue              | 0.4             | 0.55  | 92.0 / 28      |
| blue              | 0.4             | 0.7   | 92.0 / 28      |
| blue, pink        | 0.35            | 0.6   | 92.0 / 27      |
| blue, pink        | 0.4             | 0.6   | 92.1 / 27      |
| blue, pink (kept) | 0.42–0.45       | 0.6   | **92.3 / 27**  |
| blue, pink        | 0.48            | 0.6   | 92.1 / 27      |
| blue, pink        | 0.5             | 0.6   | 92.0 / 27      |
| blue, pink        | 0.45            | 0.55  | 92.5 / 28      |
| blue, pink        | 0.45            | 0.65  | 92.0 / 27      |
| blue, pink, green | 0.4             | 0.6   | 91.9 / 27      |
| blue, pink, lilac | 0.4             | 0.6   | 91.7 / 27      |
| blue, orange      | 0.4             | 0.6   | 89.6 / 33      |

Orange has no second paper: its pale shade is every orange note in shade.
Green costs 201713 a note. Kept: blue and pink, 0.44, 0.6.

| wall             | before (H3)       | after             |
| ---------------- | ----------------- | ----------------- |
| 201646           | 88 / 86 / 95 / 1  | 90 / 88 / 98 / 1  |
| 201654           | 99 / 100 / 98 / 3 | 98 / 98 / 98 / 2  |
| 201707           | 98 / 95 / 100 / 0 | 98 / 95 / 100 / 0 |
| 201713           | 99 / 100 / 98 / 0 | 98 / 98 / 98 / 0  |
| 201730 (shade)   | 93 / 94 / 92 / 2  | 93 / 94 / 92 / 2  |
| 201743 (night)   | 84 / 83 / 85 / 2  | 83 / 81 / 85 / 2  |
| wall-panorama    | 80 / 88 / 77 / 10 | 86 / 93 / 89 / 10 |
| whiteboard-dense | 93 / 96 / 89 / 11 | 93 / 96 / 89 / 10 |
| **TOTAL**        | 91.7, 29, 2/8     | **92.3, 27, 2/8** |

The panorama gains six notes (its pale pinks, apart from the vivid ones and
from each other) and loses junk; 201646 finds the periwinkle note whole;
201654 loses a merged box. Three walls gain one spurious box each (201654,
201713, the night wall), within the one-note allowance.

## Rejected

Measured on the state named in each row; TOTAL / merged, and the walls that
moved (F1 / precision / rec-A / merged).

### An off-hue pixel must also be off the wall in a*b* (on the baseline)

**Hypothesis.** 201646's lit kraft above the legend is paper to the
classifier: the dull pixels of the top floor tiles are the cool grey room, so
the tile's wall hue is 280 to 350, the kraft (h 25, s 0.2) is off the wall's
hue and needs only the 0.11 off-hue floor. In a*b* it is 7 units from the
wall. So a pixel that clears only the off-hue floor (saturation under the
tile's own floor) must also sit D units from the wall in a*b*.

| D          | TOTAL / merged | 201646     | 201713      | 201743 (night) | whiteboard  |
| ---------- | -------------- | ---------- | ----------- | -------------- | ----------- |
| off (base) | 90.7 / 29      | 85/82/93/1 | 95/96/94/0  | 80/82/77/2     | 93/96/89/11 |
| 6          | 90.2 / 29      | 83/79/93/1 | 95/96/94/0  | 75/73/77/2     | 93/96/89/11 |
| 8          | 90.2 / 29      | 84/79/95/1 | 95/96/94/0  | 71/67/74/2     | 93/97/89/11 |
| 10         | 90.6 / 29      | 84/79/95/1 | 95/96/94/0  | 76/76/74/2     | 93/97/90/11 |
| 12         | 90.0 / 33      | 86/82/95/1 | 99/98/100/0 | 77/78/74/2     | 91/96/85/15 |

The night wall's lilac note under tungsten sits 11 to 13 units from a wall
colour that is itself a blend of kraft and lamp-light, and loses its paper;
the whiteboard's rims weld at 12. 201713's jump at 12 was not the rule at all
(its mask did not change): it was the close radius flipping, which led to H1.
After H1 the kraft is no longer welded to the legend note, so the rule has
nothing left to buy.

### Dark pixels classified from a blurred colour (on H1)

**Hypothesis.** 201730's lilac note in deep shade (v 0.2) splits between the
hotspot and policy bands pixel by pixel (hue 266 to 329 as the sensor noise
takes it), so each class holds a third of it (fill 0.30). A box-blurred colour
for pixels darker than V would give the note one hue.

| radius, V | TOTAL / merged | 201707      | 201743 (night) | panorama    | whiteboard  |
| --------- | -------------- | ----------- | -------------- | ----------- | ----------- |
| off (H1)  | 91.5 / 29      | 98/95/100/0 | 81/84/77/2     | 80/88/77/10 | 93/96/89/11 |
| 1, 0.30   | 90.9 / 29      | 91/95/88/0  | 81/78/85/2     | 80/88/77/10 | 93/96/89/11 |
| 2, 0.30   | 91.6 / 30      | 92/97/88/1  | 84/80/87/2     | 83/90/81/9  | 93/96/89/12 |
| 1, 0.45   | 89.1 / 38      | 94/93/95/1  | 74/72/74/2     | 80/88/77/10 | 89/95/83/19 |
| 2, 0.45   | 89.2 / 41      | 92/90/93/1  | 78/74/82/2     | 81/89/79/12 | 89/95/84/20 |
| 1, all    | 87.7 / 40      | 90/92/88/1  | 71/70/72/2     | 73/80/72/14 | 89/95/83/16 |

The lilac note is not found at any setting, and blurring welds the seams
between flush notes (201707 loses its PASS). `scripts/h-mixed.ts` then counted
how many labelled notes have their paper split between classes: 17 of 645,
and all but two are LAPPED notes of two colours whose label takes in a strip
of the neighbour, not one note read as two kinds. A fix at the kind boundary
would buy one or two notes.

### A higher aspect ceiling (on H1)

201730's blue note 60% under a green one shows a 36×14 strip (labelled
38×19). `MAX_PAPER_ASPECT` 2.6 / 2.8 / 3.0: no change anywhere. The strip is
also under the size floor (0.39 of a note); it is what B2's sliver rule drops
on purpose.

### The size floor (on H3)

| `MIN_PAPER_SIZE_RATIO` | 0.6       | 0.65      | 0.7 (kept) | 0.75      |
| ---------------------- | --------- | --------- | ---------- | --------- |
| TOTAL / merged         | 90.9 / 30 | 91.4 / 29 | 91.7 / 29  | 91.2 / 29 |

0.65 finds five notes (201646, 201713, panorama, whiteboard) and lets in
twice as many scraps (201654 loses its 100% precision). The whiteboard's
size-floor misses are pieces of flush same-colour clusters, not small notes.

### The box constants after H1 (on H3)

Every constant of `boxes.ts` nudged both ways (TOTAL 91.7, merged 29):

| constant                     | values → TOTAL / merged                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `MIN_AREA_FRACTION` 0.35     | 0.3: 91.7/29 · 0.4: 91.7/29                                                     |
| `MERGE_GAP_FRACTION` 0.12    | 0.06: 91.5/30 · 0.075: 91.7/30 · 0.09: 91.8/29 · 0.105: 91.7/29 · 0.15: 91.5/29 |
| `MERGE_MIN_FILL` 0.55        | 0.45: 91.4/30 · 0.65: 91.6/30                                                   |
| `MERGE_REACH_FRACTION` 0.3   | 0.25: 91.7/29 · 0.35: 91.7/29                                                   |
| `MERGE_REACH_MIN_FILL` 0.7   | 0.65: 91.7/29 · 0.75: 91.7/29                                                   |
| `WHOLE_NOTE_SIDE` 0.45       | 0.4: 91.7/29 · 0.5: 91.7/29                                                     |
| `MIN_PAPER_FILL` 0.45        | 0.4: 91.7/29 · 0.5: 91.6/29                                                     |
| `MAX_PAPER_SIZE_RATIO` 2.6   | 2.3: 91.7/29 · 2.9: 91.7/29                                                     |
| `CUT_PIECE_SIZE_RATIO` 0.6   | 0.55: 91.7/28 · 0.625: 91.7/29 · 0.65: 91.8/29 · 0.675: 91.8/29 · 0.7: 91.8/30  |
| `RESCUE_ERODE_FRACTION` 0.12 | 0.09: 91.7/29 · 0.15: 91.7/29                                                   |
| `MIN_SOLID_FILL` 0.55        | 0.5: 91.7/29 · 0.6: 91.7/29                                                     |

Two single-note bumps, neither kept. `MERGE_GAP_FRACTION` 0.09 takes one
spurious box off the night wall, but it is a lone value: 0.075 merges two of
201707's notes and 0.105 is the baseline. `CUT_PIECE_SIZE_RATIO` 0.65–0.675
finds one panorama note, but 0.7 adds a merged box on the whiteboard and 0.55
takes one off 201654: a ridge two values wide, for one note.

### The colour constants after H1 (on H3)

A2's constants, nudged both ways once the close changed (TOTAL 91.7,
merged 29):

| constant                         | values → TOTAL / merged                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| `OFF_HUE_MIN_SATURATION` 0.11    | 0.10: 91.1/29 · 0.12: 91.4/29                                           |
| `WALL_HUE_NEIGHBOURHOOD_DEG` 34  | 31: 90.2/36 · 37: 91.3/30                                               |
| `WALL_HUE_MIN_LAB_DISTANCE` 7    | 6: 91.5/30 · 8: 91.3/30                                                 |
| `PALE_PAPER_MIN_LAB_DISTANCE` 12 | 10: 90.5/36 · 10.5: 90.7/37 · 11: 92.0/31 · 11.5: 91.9/30 · 13: 91.6/29 |
| `WALL_SATURATION_MARGIN` 0.14    | 0.12: 91.5/29 · 0.16: 91.6/28                                           |
| `MIN_PAPER_SATURATION` 0.28      | 0.26: 91.3/32 · 0.30: 91.1/27                                           |
| `WALL_VALUE_RATIO` 0.7           | 0.65: 89.2/38 · 0.75: 91.3/29                                           |
| `NARROW_SHORT_RATIO` 0.5         | 0.45: 91.8/30 · 0.55: 91.4/29                                           |
| `NARROW_LONG_RATIO` 0.9          | 0.85: 91.7/29 · 0.95: 91.6/29                                           |

`PALE_PAPER_MIN_LAB_DISTANCE` 11 to 11.5 finds two to four more of the
panorama's pale pinks (rec-A 77 → 81–85) but merges one or two more boxes
there, and half a unit lower the whiteboard's dense orange notes weld through
their rims (merged 11 → 18): a slope to a cliff, not a plateau.

### Rims are not pale paper (on H3)

**Hypothesis.** What welds the whiteboard below a pale distance of 11 is the
blurred rim of a vivid note, which the pale rule calls paper. A rim touches the
vivid paper it blurs from; a pale note does not. So a pixel only the pale rule
calls paper is dropped when a non-pale pixel of the same class lies within R.

| R, pale distance | TOTAL / merged | 201743 (night) | panorama    | whiteboard  |
| ---------------- | -------------- | -------------- | ----------- | ----------- |
| off, 12 (H3)     | 91.7 / 29      | 84/83/85/2     | 80/88/77/10 | 93/96/89/11 |
| 1, 12            | 91.1 / 30      | 83/81/85/2     | 77/79/77/11 | 93/96/89/11 |
| 2, 12            | 91.6 / 29      | 82/81/82/2     | 81/87/79/10 | 93/96/89/11 |
| 2, 11            | 91.4 / 31      | 82/80/85/2     | 80/82/81/12 | 93/96/89/11 |
| 2, 10            | 90.3 / 30      | 66/62/69/2     | 80/84/79/11 | 93/96/89/11 |
| 3, 10            | 91.8 / 31      | 81/79/82/2     | 83/90/83/12 | 93/96/89/11 |

It is the rims: with the rule, the whiteboard no longer welds at 10. But the
panorama's pale pinks lose their own edges with them and merge where they lap,
and the night wall's lilac note under tungsten goes. Nothing beats 91.7 / 29.
