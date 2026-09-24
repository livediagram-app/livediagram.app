# Experiments, group K: geometry, round 4

Three ideas from the second round of research
([research.md](../research.md)), each decided by the sweep over the eight
labelled walls, for the bar of
[plans/event-storming-photo-95.md](../../../plans/event-storming-photo-95.md).
Plan: [plans/event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md)
(K). Earlier separation rounds: [b-separation.md](b-separation.md),
[b2-separation.md](b2-separation.md), [i-separation.md](i-separation.md).

- **K1**: place all the cuts across a run at once, by dynamic programming
  over the paper's profile, instead of the greedy `cutLines`.
- **K2**: a local note-size field: size rules use the size HERE.
- **K3**: amodal completion: the lower note of a lapped pair completed from
  its visible part into a box of its own.

Every table gives, per wall, **F1 / precision / recall without actors /
merged boxes**; TOTAL is F1 / merged.

## Where it started

Commit `5ad4347c`, the merged state after round 3.

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 95 / 98 / 98 / 1           |
| 201654           | 98 / 98 / 98 / 2           |
| 201707           | 98 / 95 / 100 / 0          |
| 201713           | 98 / 98 / 98 / 0           |
| 201730 (shade)   | 94 / 94 / 94 / 2           |
| 201743 (night)   | 86 / 88 / 85 / 2           |
| wall-panorama    | 86 / 93 / 89 / 8           |
| whiteboard-dense | 94 / 97 / 91 / 8           |
| **TOTAL**        | **93.5 / 23**              |

Two walls pass (201707, 201713). Of the 23 merged boxes (`merged.ts`), 13
are overlapping labels (for the operator), 1 cross-colour, 9 same-colour:
seven on the panorama (its lattice of small actors, 20 px on a wall whose
note is 34), two small pairs on the whiteboard, and one lapped pair on 201730.

## K0: the survey

**How much the note size varies across a wall.** The labelled notes' short
side, median per fifth of the photograph's width (actors left out):

| wall             | fifths (px, notes)                      |
| ---------------- | --------------------------------------- |
| 201646           | 57 (4) 55 (6) 52 (8) 51 (12) 53 (10)    |
| 201654           | 50 (10) 47 (11) 49 (7) 44 (12) 44 (12)  |
| 201707           | 64 (6) 48 (11) 37 (14) 56 (6) 71 (4)    |
| 201713           | 41 (13) 40 (8) 37 (19) 39 (6) 38 (8)    |
| 201730 (shade)   | 43 (7) 45 (7) 37 (11) 34 (14) 35 (13)   |
| 201743 (night)   | 28 (9) 43 (13) 41 (6) 15 (9) 15 (2)     |
| wall-panorama    | 34 (4) 35 (8) 36 (6) 35 (17) 23 (12)    |
| whiteboard-dense | 18 (80) 18 (32) 18 (55) 19 (60) 19 (26) |

The size moves by up to a factor of two across 201707, 201743 and 201730;
the panorama's last fifth is its pad of small actors and hotspots. By kind,
the panorama's actors are 18–36 px (median 22) and its hotspots 19–42: a
colour's own size does not describe a region.

**How the labels draw lapped notes.** Of the pairs of labels that overlap,
89 overlap by 5–15% of the smaller, 52 by 15–30%, 25 by 30–60% and 12 by
more: the labeller traced the whole note where it could be seen or
inferred, not only its visible part.

## K1: all the cuts at once (rejected)

**Hypothesis.** `cutLines` snaps each cut to the emptiest line of the raw
mask within 0.3 of a step of its even position, one cut at a time. Chosen
together, the cuts would take the seams the paper shows and share the rest
of the run out evenly, instead of one cut moving while the next stays where
the even grid put it.

**Built (scratch).** `placeCuts(profile, pieces, …)`: dynamic programming
over the line-by-line paper profile (a line's paper against the mean line);
a cut costs its line's fill, capped at `VALLEY_MAX_FILL` (0.7, so all paper
costs the same), and each piece costs `w × ((length − share) / share)²`,
no piece under half a share. Unit tests passed: even cuts on flat paper,
cuts on seams, the rest re-spaced.

First, how much placement matters at all: the greedy snap's reach.

| reach (steps) | 0           | 0.15          | 0.3 (today) | 0.45            |
| ------------- | ----------- | ------------- | ----------- | --------------- |
| TOTAL         | 93.3 / 26   | 93.4 / 26     | 93.5 / 23   | 92.5 / 26       |
| moves         | 201707 +1 m | panorama +2 m | —           | whiteboard +2 m |

It matters: the panorama's precision swings 85–94 with the reach alone.

| DP variant                                                                              | TOTAL / merged                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------- |
| quadratic length cost, w = 1 / 3 / 6 / 12 / 30                                          | 93.2/25, 93.2/26, 93.0/25, 93.0/25, 93.2/25 |
| free within ±t of a share, w = 3: t = 0.15 / 0.3 / 0.45 / 0.6                           | 92.7/28, 91.7/27, 91.6/28, 91.5/26          |
| the same, w = 100 (a hard window)                                                       | 93.0/26, 92.6/24, 91.6/27, 91.3/26          |
| each cut kept within ±0.3 step (the greedy's own window), w = 0 / 1 / 3                 | 93.1/22, 93.3/24, 93.0/26                   |
| the number of pieces chosen too (k − 1…k + 1, lengths against the note), w = 1 / 3 / 10 | 90.9/43, 92.1/32, 92.2/33                   |

Every variant scores below the greedy. The closest (the greedy's window,
re-spacing only) parts two whiteboard pairs (merged 8 → 6) but 201707 loses
a note and a merged box appears there (PASS → FAIL), and the panorama loses
two notes: the misses and spurious boxes reshuffle, note for note, which is
what cut placement on flush paper does when the mask has no seam to place
on. Choosing the number of pieces is far worse (whiteboard merged 8 → 15–22).

**Verdict: rejected.** On a flush run the profile has no valley to find,
and re-spacing the cuts it has no seam for moves them as often off the
notes as onto them; the greedy's hard window around the even step is the
better prior.

## K2: the note size here (kept, for the seam cut)

**Hypothesis.** Size rules divide by one wall median. On a wide or angled
photograph (K0) the size here differs, and the panorama's lattice of small
actors (18–20 px) is cut against a 34 px note: every pair there is under
the seam cut's 1.3-note span.

**Built.** `size-field.ts`, `noteSizeField(samples, wallSize)`: for a point,
the median short side of the plausible raw blobs (the ones the wall's size
is measured from) around it, kept within half and twice the wall's size,
the wall's size where there are too few. `fitBoxes` takes a `sizeField`
(`boxes.ts`), `detect.ts` builds it.

**Which rule reads it** (first estimator: the 15 nearest samples):

| the local size used by          | TOTAL / merged | what moved                                               |
| ------------------------------- | -------------- | -------------------------------------------------------- |
| nothing (reference)             | 93.5 / 23      |                                                          |
| the splitter's grid (and necks) | 88.6 / 26      | 201707 prec 95 → 83, night 88 → 80, whiteboard merged 13 |
| the seam cut                    | 94.1 / 19      | panorama merged 8 → 4, 201707 prec 95 → 98               |
| the notch cut                   | 93.5 / 23      | nothing                                                  |
| split, seam and notch           | 88.1 / 27      |                                                          |
| the size floor                  | 92.8 / 25      | 201707 prec 95 → 91, night −3 notes                      |
| the too-big gate                | 93.5 / 22      | panorama merged −1, 201707 −1 note                       |
| all of them                     | 86.1 / 25      |                                                          |

Only the seam cut gains. Its bounds do not bind: 0.3–0.5 and 1–3 score
alike (0.6 parts one pair fewer), so every gain is the size being SMALLER
here.

**The estimator.** The nearest-N median is a knife edge: the panorama has
only 60 plausible samples, a mixture of 17–18 px actors and 34 px notes,
and the median flips as N crosses from one pad into the other.

| nearest N | 5         | 8         | 11        | 15        | 20        | 30        | 50        |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| TOTAL / m | 93.6 / 20 | 93.6 / 21 | 93.6 / 21 | 94.1 / 19 | 93.8 / 24 | 93.8 / 23 | 93.5 / 23 |

A Gaussian-weighted median instead (spread σ in wall notes, and a minimum
total weight below which the wall's size stands) slides between regions:

| σ (weight 3) | 1         | 1.25      | 1.5       | 2         | 3         | 4         | 6         |
| ------------ | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| TOTAL / m    | 93.4 / 22 | 93.8 / 21 | 93.9 / 20 | 93.8 / 20 | 93.6 / 21 | 93.9 / 22 | 93.7 / 24 |

| weight (σ 1.5) | 1         | 2         | 2.5       | 3         | 4         | 6         |
| -------------- | --------- | --------- | --------- | --------- | --------- | --------- |
| TOTAL / m      | 93.5 / 22 | 94.0 / 20 | 94.0 / 20 | 93.9 / 20 | 93.8 / 21 | 93.6 / 22 |

σ 1.25–2 with weight 2–3 is a plateau (93.8–94.0, 19–21 merged); at σ 3
the whiteboard loses a note, at weight 1 a pair of scraps sets the size. At
σ 1.5, weight 2.5:

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 95 / 98 / 98 / 1           |
| 201654           | 98 / 98 / 98 / 2           |
| 201707           | 99 / 98 / 100 / 0          |
| 201713           | 98 / 98 / 98 / 0           |
| 201730 (shade)   | 94 / 94 / 94 / 2           |
| 201743 (night)   | 86 / 88 / 85 / 2           |
| wall-panorama    | 89 / 93 / 89 / 5           |
| whiteboard-dense | 94 / 97 / 91 / 8           |
| **TOTAL**        | **94.0 / 20**              |

What moved: on the panorama, the 3×2 block of actors and hotspots at the
top of the lattice (the one cross-colour box) and the hotspot pair on the
left are parted, and their small notes found; on 201707 a spurious
box (50×34) is gone.
Actors are outside rec-A, so the panorama's gain shows in its F1 and its
merged count.

With the field in place, the local size for the other rules was measured
again: the necks at the local size 94.0 / 21–22 (201646 loses a box's
precision), the splitter's grid 92.4 / 21 (panorama precision 77, night
−3 notes), the speck (area) gate unchanged.

**Verdict: kept, for the seam cut only.** TOTAL 93.5 → 94.0, merged 23 →
20, no wall loses anything. Commits `d9bcd144` (the field, a pure module)
and `b4630943` (the wiring: `boxes.ts`, `detect.ts`).

### The seam's span, re-swept on the local size (kept)

The seam cut's constants were set against the wall's size. Re-swept with
the field:

| SEAM_MIN_SPAN | 1.2       | 1.25      | 1.3       | 1.35      | 1.4       | 1.45      | 1.5       | 1.55      |
| ------------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| TOTAL / m     | 93.7 / 20 | 93.8 / 20 | 94.0 / 20 | 94.1 / 20 | 94.1 / 20 | 94.1 / 21 | 94.1 / 21 | 94.1 / 22 |

At 1.2 201713 loses a note; 1.35–1.5 all find one more actor on the panorama
than 1.3. The others hold: `STEP_MIN_SPAN` 1.5 93.9, 1.7 93.6 / 22;
`SEAM_MIN_DEPTH` 10 93.9, 14 93.7 / 22; `SEAM_MIN_PIECE` 0.5 94.0, 0.6
94.1. The field re-swept at 1.4: σ 1–1.75 all 94.1 (19–21 merged), 2
93.5 / 22, 3 93.7 / 21; weight 2 and 3 both 94.1 / 20.

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 95 / 98 / 98 / 1           |
| 201654           | 98 / 98 / 98 / 2           |
| 201707           | 99 / 98 / 100 / 0          |
| 201713           | 98 / 98 / 98 / 0           |
| 201730 (shade)   | 94 / 94 / 94 / 2           |
| 201743 (night)   | 86 / 88 / 85 / 2           |
| wall-panorama    | 91 / 95 / 91 / 5           |
| whiteboard-dense | 94 / 97 / 91 / 8           |
| **TOTAL**        | **94.1 / 20**              |

**Verdict: kept** (`c1e90f9c`): TOTAL 94.0 → 94.1, one panorama note, on a
plateau of 1.35–1.5.

### Round 3's dropped cuts, on the local size (rejected again)

Two of group I's cuts were taken out at integration. Replayed on top of K2:

| variant                                                                 | TOTAL / merged                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| a seam between two pads' colours (I4), step 25 / 28 / 30 / 32 / 36 / 45 | 93.4/20, 94.0/19, 94.0/19, 94.2/19, 94.1/20, 94.1/20 |
| a thin box at its own thickness (I2), 0.6 / 0.7 / 0.8                   | 94.1/20, 94.1/21, 94.1/22                            |

The colour seam's gain sits on one value (32), with the panorama losing
two notes of precision three levels either side: still a knife edge. The
thin-box scale is what the field now does, and on top of it only adds
merged boxes.

## K3: amodal completion (rejected, on the probes)

**Hypothesis.** A note lapped under another shows a strip of itself. The
visible part is refused (too thin for the size floor, or a cut that leaves
it is refused), and the box of the note on top holds both centres.
Completing the strip into a note from its visible edge (a square on its
long side, grown under its neighbour) would give the lower note a box of
its own.

Three places a lapped note shows, each probed before building
(`scripts/amodal-probe.ts`, `scripts/notch-probe.ts`):

- **The boxes the size floor refuses.** 254 of them across the eight
  walls. Completed as above, 8 would match a labelled note the detector
  misses (5 distinct). Limited to strips a whole note long, at least 0.4 of
  a note deep, solid (fill ≥ 0.7), with paper beyond the side it grows
  under: 1 note against 9 that are not one.
- **A seam cutting a sliver off one end of a detection** (a probe of
  `seam.ts`: boxes 1.05–1.6 local notes long, the deepest line leaving
  0.12–0.45 of a note at one end): it fires on 3 lapped pairs and on 172
  single notes, and the single notes' depths (12–54) cover the pairs'
  (15–29). A note's own edge, its curl and its shadow sit exactly where a
  lapped note's edge would.
- **A notch in the outline** (the deepest convexity defect of a detection
  1.05–1.8 notes long): deeper than 0.2 of a note in 3 of the 10 merged
  pairs and in 41 of 370 single notes; deeper than 0.12 in 5 against 70.

**Verdict: rejected without a sweep.** At 18–40 px a note, the part of a
lapped note that shows is not told apart from a single note's own edge by
its size, its seam or its outline, and each probe's best rule invents
several notes for every one it finds. What is left of the lapped pairs
(201730 #0, whiteboard #1 and #5) is the boundary model's (group E) or a
better photograph's.

## Where it ended

Kept, in order: `d9bcd144` (the size field), `b4630943` (its wiring in
`boxes.ts` and `detect.ts`), `c1e90f9c` (the seam's span), `460c58b0`
(the field's plateau, re-measured, in its comments).

|             | TOTAL | precision | recall | merged | walls passing      |
| ----------- | ----- | --------- | ------ | ------ | ------------------ |
| round start | 93.5  | 96        | 91     | 23     | 2 (201707, 201713) |
| round end   | 94.1  | 96        | 92     | 20     | 2 (201707, 201713) |

Against the start, the panorama misses 11 notes instead of 17 and makes 4
spurious boxes instead of 5, and 201707 one spurious box instead of two;
no other wall moves. The 20 merged boxes left (`merged.ts`): 13
overlapping labels (for the operator), no cross-colour box, and 7
same-colour: four on the panorama (two rows of two small actors, a big actor
beside a small one, a 30×33 pair) whose seams show neither a shadow nor a
step at their own scale, two small pairs on the whiteboard and the lapped
pair on 201730 (K3).

What would come next: the panorama's rows of two actors show their seam
only in colour (two pads), so a colour seam that holds on more than one
value, perhaps read against the local size's own margins; and, for the
lapped pairs, the learned boundary model.

## Open questions

- **`boxes.ts` and `detect.ts`**: commit `b4630943` adds the `sizeField`
  option to `fitBoxes` (read only by the seam cut), exports
  `isPlausibleNote`, and builds the field in `detect.ts`. It is committed
  separately so the parent can integrate it on its own.
