# Experiments, group N: recall on the night wall and the whiteboard

Recall without actors on the three walls furthest from the bar: the night
wall 201743 (tungsten light, a window, reflections), the whiteboard (19 px
notes, glare, notes fallen on the floor) and the shaded 201730. Decided by
both sweeps over the eight labelled walls, for the bar of
[plans/event-storming-photo-95.md](../../../plans/event-storming-photo-95.md):
the HYBRID one (classical + group E's boundary model, `sticky-model`,
`npx tsx scripts/hybrid/sweep.ts --kept`) and the CLASSICAL one
(`sticky-vision`, `npx tsx scripts/calibrate.ts`), because the editor falls
back to the classical detector when the model cannot run. Plan:
[plans/event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md)
(N). The hybrid itself is [j-hybrid.md](j-hybrid.md).

Every table gives, per wall, **F1 / precision / recall without actors /
merged boxes**; TOTAL is F1 / merged.

## The short answer

One rule kept: **a small note the model is sure of, among boxes of its own
size** (N2). Hybrid TOTAL **95.5 → 95.8**, merged 16 (none real), the night
wall's recall without actors **85 → 90%**, the panorama's 96 → 98%, precision
unchanged; the classical sweep is untouched (94.1 / 20). Six other rules were
measured and rejected. What is left on the three walls is, note by note,
either an overlapping label (for the operator) or beyond what the photograph
gives: see [what is left](#what-is-left-note-by-note).

## Where it started

Commit `7eeb87fc`.

| wall             | classical         | hybrid (J)                  |
| ---------------- | ----------------- | --------------------------- |
| 201646           | 95 / 98 / 98 / 1  | 96 / 98 / 100 / 1           |
| 201654           | 98 / 98 / 98 / 2  | 98 / 98 / 98 / 2            |
| 201707           | 99 / 98 / 100 / 0 | 99 / 98 / 100 / 0           |
| 201713           | 98 / 98 / 98 / 0  | 99 / 98 / 100 / 0           |
| 201730 (shade)   | 94 / 94 / 94 / 2  | 94 / 94 / 94 / 2            |
| 201743 (night)   | 86 / 88 / 85 / 2  | 90 / 95 / 85 / 2            |
| wall-panorama    | 91 / 95 / 91 / 5  | 95 / 95 / 96 / 1            |
| whiteboard-dense | 94 / 97 / 91 / 8  | 95 / 97 / 93 / 8            |
| **TOTAL**        | **94.1 / 20**     | **95.5 / 16** (real 0), 2/8 |

## N0: where every miss is lost (tools)

`scripts/hybrid/misses.ts` lists, per note the hybrid misses: the box that
holds its centre (a merged box, or another note's), the paper fraction under
it, the classical drop that best overlaps it (gate and IoU), how much of it
another LABEL covers ("lap", of the smaller of the two), and the model note
that best overlaps it with every number the add rule reads, including which
box covers it. `region.ts` prints the labels, classical boxes, hybrid boxes
and model notes of one region side by side; `agreement.ts` and `refused.ts`
are the probes of N1 and N5. Positions and numbers only.

What the three walls miss (hybrid, before N2):

| wall           | non-actor misses | overlapping labels (lap ≥ 0.5) | model sees it (or part), not taken     | model sees nothing        |
| -------------- | ---------------- | ------------------------------ | -------------------------------------- | ------------------------- |
| 201743 (night) | 6 of 39          | 2                              | 2 far-board notes (area 0.1 of median) | 2 far-board notes         |
| 201730 (shade) | 3 of 52          | 1                              | 2 (a lapped pair, a strip)             | 0                         |
| whiteboard     | 17 of 253        | 7                              | 8 (carpets of flush notes, pale notes) | 2 (floor heap, pale note) |

## N1: reseat a box the model disagrees with (rejected)

**Finding.** The whiteboard's left carpet (x 0-110, y 245-330) is 25 labelled
notes laid staggered like bricks; the classical grid cuts it in rows at fixed
y (268, 286, 300), so its boxes sit half a note off the notes, while the model
sees 22 of the 25 at confidence 0.7-0.96.

**Hypothesis.** A classical box that agrees with no sure model note (best IoU
under τ) but holds sure notes' core centres is a misplaced cut; the notes
replace it. Measured on J's state (before N2).

| τ   | conf 0.7, area 0.3 | conf 0.75, area 0.5 | conf 0.85, area 0.5 |
| --- | ------------------ | ------------------- | ------------------- |
| 0.2 | 95.4 / 17          | 95.5 / 17           | 95.5 / 16           |
| 0.3 | 95.5 / 17          | 95.5 / 17           | 95.5 / 16           |
| 0.4 | 95.5 / 18          | 95.5 / 19           | 95.5 / 16           |
| 0.5 | 94.8 / 19          | 95.4 / 20           | 95.5 / 16           |

The whiteboard gains at most one note, and from τ 0.3-0.5 201654 and 201646
lose notes. `agreement.ts` says why: the best IoU with a sure note does not
separate right boxes from wrong ones. On the whiteboard 52 matched boxes sit
under 0.6 and 3 spurious ones at or above it; on every wall matched boxes reach down
to 0.3 (the scorer matches by centre and area, and a half-offset cell still
matches one of its two notes).

**Verdict: rejected.**

## N2: small sure notes among a pad of their size (kept)

**Finding.** The night wall's far board, seen through the window, is a pad
of 15 px notes, about 0.1 of the median box. The model is sure of two of the
four missed ones (0.76, 0.82, paper 1.00), but J2's size floor (0.3 of the
median box) is where junk lives too; the found notes of the same board stand
a note or two away.

**Hypothesis.** Junk that small comes alone; a far board or a pad of small
stationery comes as a cluster of like-sized notes (the classical `findPads`
rule, F2). A small sure model note with found boxes of its own size around it
is a note.

**Rule** (`pad` in `HybridRules`). After ADD: a model note with confidence ≥
`minConfidence`, held by no box and holding no box's centre, on paper
(`minPaper`), with at least `minSiblings` boxes whose side (√area) is within
`sizeRatio` of its own either way and whose centre lies within `reach` of the
larger side. The pads' notes then count as siblings for the next.

| size ratio × reach, 3 siblings | conf 0.7  | 0.75      | 0.8       |
| ------------------------------ | --------- | --------- | --------- |
| 1.3-1.7 × 2                    | 95.6 / 16 | 95.5 / 16 | 95.5 / 16 |
| 1.3-1.7 × 3-4                  | 95.8 / 16 | 95.7 / 16 | 95.6 / 16 |
| two siblings, any reach 2-4    | 95.7-95.8 | 95.7      | 95.5-95.6 |

| confidence (paper 0.5) | 0.55-0.7 | 0.72 | 0.75 |
| ---------------------- | -------- | ---- | ---- |
| TOTAL                  | 95.8     | 95.7 | 95.7 |

Paper 0.4 and 0.5 score alike, 0.6 loses the panorama note. Kept: confidence
0.65, paper 0.45, size ratio 1.5, reach 3, three siblings, the middle of the
plateau. Against the cue threshold it holds everywhere J1 does:

| cue threshold t   | 0.4  | 0.45 | 0.5  | 0.55 | 0.6  |
| ----------------- | ---- | ---- | ---- | ---- | ---- |
| without the pad   | 95.2 | 95.6 | 95.5 | 95.5 | 95.3 |
| with the pad      | 95.5 | 95.9 | 95.8 | 95.8 | 95.5 |
| night rec-A (pad) | 90   | 90   | 90   | 90   | 90   |

| wall             | before (J)         | after (N2)         |
| ---------------- | ------------------ | ------------------ |
| 201646           | 96 / 98 / 100 / 1  | 96 / 98 / 100 / 1  |
| 201654           | 98 / 98 / 98 / 2   | 98 / 98 / 98 / 2   |
| 201707           | 99 / 98 / 100 / 0  | 99 / 98 / 100 / 0  |
| 201713           | 99 / 98 / 100 / 0  | 99 / 98 / 100 / 0  |
| 201730 (shade)   | 94 / 94 / 94 / 2   | 94 / 94 / 94 / 2   |
| 201743 (night)   | 90 / 95 / 85 / 2   | 93 / 95 / 90 / 2   |
| wall-panorama    | 95 / 95 / 96 / 1   | 96 / 95 / 98 / 1   |
| whiteboard-dense | 95 / 97 / 93 / 8   | 95 / 97 / 93 / 8   |
| **TOTAL**        | **95.5 / 16**, 2/8 | **95.8 / 16**, 2/8 |

Two night notes and one panorama note found, nothing invented. The classical
sweep does not move (the rule runs only with a model). **Verdict: kept**
(commit `2e92be29`).

## N3: a box two notes long (rejected)

**Finding.** A whiteboard note (136,346) sits inside a 14×32 strip the grid
cut across two notes; the model sees both notes (0.83, 0.81), under J1's 0.86.

**Split it at a lower confidence when the box is two notes long** (the length
corroborating the model): no box moves at any length 1.3-1.8 × confidence
0.7-0.83, and 0.7-0.75 cost the panorama a note. The strip's second core
centre lies outside the strip, so only one core is inside it.

**Shrink a long box to the one sure note in it** (the note at most a share of
the box's length):

| length × confidence | share 0.5-0.7 |
| ------------------- | ------------- |
| 1.3 × 0.7           | 95.8 / 15-16  |
| 1.3 × 0.8           | 95.7 / 16     |
| 1.5 × 0.7-0.8       | 95.8 / 16     |
| 1.5 × 0.85          | 95.6          |
| 1.7 × any           | 95.6          |

The whiteboard gains its note (93 → 94) and the panorama loses one (98 → 96)
at every setting, even where the whiteboard gains nothing. **Rejected.**

## N4: the add rule's low end, for pale notes (rejected)

The whiteboard's pale note at 383,343 is a model note of confidence 0.70,
0.26 of the median box, paper 0.54, just under J2's bar. Re-swept on N2:

| confidence \ area | 0.2  | 0.25 | 0.3  |
| ----------------- | ---- | ---- | ---- |
| 0.65              | 95.5 | 95.6 | 95.7 |
| 0.68              | 95.6 | 95.7 | 95.9 |
| 0.7               | 95.6 | 95.6 | 95.8 |
| 0.72-0.75         | 95.7 | 95.8 | 95.8 |

The pale note is never found: the model sees a 10×10 piece of a 15×14 note,
too small to match its label even when added. 0.65-0.68 find 201654's note at
the frame's edge, but 0.65 adds a night box and areas 0.2-0.25 a 201707 box:
the gain stands on one cell (0.68 × 0.3). The add rule's centre tests were also given a margin (a box holds
the note's centre only if the centre is `margin` of its side inside), for the
whiteboard note whose model note (0.86) a half-offset box holds by half a
pixel: margin 0.03 changes nothing, 0.06 finds it (whiteboard 93 → 94) but
adds two duplicate boxes on 201646 (95.7), 0.1 costs 201713 its PASS (95.5).
**Rejected.**

## N5: a refused classical box the model confirms (rejected on the probe)

201730's blue note 60% under a green one shows a 36×14 strip, refused for its
aspect; the model has a core in it. `refused.ts` asks the general question:
of every box the classical gates refuse, held by no kept box, how many would
match a missed label, by gate and by the most confident model core inside:

| gate       | core 0.5-0.6 | core 0.6-0.7 | core 0.7-0.8 | core ≥ 0.8 | no core |
| ---------- | ------------ | ------------ | ------------ | ---------- | ------- |
| size-floor | 0 / 5        | 1 / 16       | 0 / 4        | 2 / 2      | 2 / 222 |
| aspect     | 0 / 10       | 0 / 2        | 0 / 6        | 0 / 2      | 0 / 161 |
| rescue     | 0 / 7        | 0 / 11       | 0 / 5        | 1 / 2      | 1 / 128 |
| standout   | 1 / 0        |              | 0 / 1        | 0 / 1      | 2 / 27  |
| area       |              | 0 / 1        | 0 / 3        |            | 1 / 45  |

(notes / junk). The ≥ 0.8 hits are one actor on 201646 seen by three gates.
A model core does not make a refused box a note, which is K3's finding with
the model added. 201730's strip is not even in the table: its neighbour's box
holds its centre by a pixel. **Rejected without a sweep.**

## N6: the classical guess, re-placed by the model (rejected)

`cutLines` knows when a cut is a guess: where the paper shows no seam it cuts
on the even step. Marking those cells (`guessed`) and letting the hybrid
replace a guessed cell by the sure model notes in it:

| confidence \ area | 0.2          | 0.3          | 0.5          |
| ----------------- | ------------ | ------------ | ------------ |
| 0.6-0.75          | 94.9 / 18-19 | 95.3 / 18-19 | 95.7 / 18-19 |
| 0.8               | 94.9 / 18    | 95.2 / 18    | 95.6 / 18    |
| 0.86              | 95.6 / 16    | 95.6 / 16    | 95.9 / 16    |

The big-note walls pay (201646 96 → 92, 201730 94 → 92, 201713 99 → 97): a
guessed cell there is usually right, and the model's notes on a note with a
line across are halves. The one gain sits on the grid's corner. **Rejected.**
The classical fallback has nothing new to take either: the far board's
remaining classical misses are one fused 67×34 block `standsOut` refuses,
which group H cut by the pad's note and rejected (night precision 81 → 73).

## What is left, note by note

After N2, hybrid. "Lap" is how much of the note (or of the other, whichever
is smaller) another label covers; two labels over one note, or a note traced
whole where it lies almost entirely under another, cannot both be matched.

**201743 (night), 35 of 39 (90%).**

- Two overlapping labels (lap 0.72 and 0.50), each in a box of its twin.
  Fixed, the wall reads 35 of 37 (94.6%).
- The far board's top-left note (711-726, 191-205): only a 9×14 sliver shows
  beside the window frame, paper 0.43 of its label; the model sees nothing.
- The far board's note at 781-797, 224-240: 16 px behind the window glass, a
  yellow actor lapped over its top; in the dim tungsten light its paper reads
  hue 29-45, half orange and half yellow pixel by pixel, so each colour class
  holds only specks (noise-dropped), and the model shows at most a faint
  11×10 blob of 0.55 at a lower threshold, under half the note. Beyond what
  the photograph gives.

**201730 (shade), 49 of 52 (94%).**

- One duplicate label (lap 0.95). Fixed, the wall reads 49 of 51 (96%).
- The lapped pair at 624,113: the upper note hides the lower one's top
  half; colour and model both read one note (the model's 39×52 at 0.85).
- The blue note 60% under a green one: a 36×14 strip, refused for its aspect,
  whose centre the green note's box holds by a pixel (N5).

**Whiteboard, 236 of 253 (93%).**

- Seven overlapping labels (lap 0.57-1.00): four notes almost entirely under
  a neighbour in the carpets, traced whole, and three labels on the heap of
  notes on the floor. Fixed, the wall reads 236 of 246 (95.9%).
- The heap on the floor (y 680-740, x 540-700), the hotspot at 597,699 (lap
  0.47): notes lying flat on the carpet, foreshortened to 11-17 px high and
  lying over each other; the model, trained on walls, sees no note there at
  all, and the colour sees one blob of three.
- The staggered carpets (68,268; 42,282; 136,346; 178,345; 144,400): the
  model sees these notes, but a classical box holds each one's centre (N1,
  N3, N4's margin) or the model reads two lapped notes as one (42,282 as a
  17×33 note; 178,345 and 144,400 as one each, lap 0.29-0.39).
- Pale notes (383,343; 688,503; 372,612): standout 0.07-0.12 on a white
  board; the model sees a piece of one and nothing of the others (N4).
- A 14×13 note at 736,537 whose model note (0.86) is the neighbour's box,
  9 px off the label (lap 0.44).

## Where it ends

|                    | hybrid TOTAL | precision | rec | merged (real) | walls passing | classical TOTAL |
| ------------------ | ------------ | --------- | --- | ------------- | ------------- | --------------- |
| start (`7eeb87fc`) | 95.5         | 97        | 95  | 16 (0)        | 2/8           | 94.1 / 20       |
| end (N2)           | **95.8**     | 97        | 95  | 16 (0)        | 2/8           | 94.1 / 20       |

With the overlapping labels fixed by the operator, 201730 and the whiteboard
would clear the recall bar on the hybrid (96%, 95.9%), and the night wall
would stand one note short (94.6%), that note behind the glass.

## What to try next

- **The labels.** Ten of the three walls' misses are overlapping labels; they
  decide whether 201730 and the whiteboard pass. `misses.ts` prints each
  one's lap for the review.
- **A model that sees a floor heap and staggered carpets.** E's generator
  places notes on walls in rows; lapped bricks of 18 px notes and notes lying
  flat on carpet are what the whiteboard still loses to the model.
- **Each component's own pixels in the splitter.** The whiteboard's identical
  duplicate boxes (G8) come from `tightenTo` shrinking a grid cell onto a
  separate component inside the sprawl's bounding box; tightening onto the
  sprawl's own pixels is the root fix (precision, about +0.2).
