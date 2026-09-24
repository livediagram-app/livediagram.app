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
