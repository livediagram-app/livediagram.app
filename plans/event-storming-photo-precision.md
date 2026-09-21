# Photo import: detect the stickies, and only the stickies

Follow-on to [`event-storming-photo-surface-and-shade.md`](event-storming-photo-surface-and-shade.md),
which fixed RECALL (the wall's pale and shaded notes are now found) and rebuilt
the review as one surface. The operator's verdict on that work:

> "I really like how it got all stickies, but it needs some finetuning to be
> correct."

So this plan is about PRECISION, and about one structural defect that recall
work exposed. Everything here comes from one annotated screenshot of
`test-files` photo of the gym wall, at 66 detections.

## The four defects, as the operator named them

1. **It detects things above the paper.** A row of boxes sits along the top
   edge, on the white wall / ceiling strip ABOVE the kraft paper, and more on
   the shelf and bottles at the left.
2. **Four grouped stickies are read as one note.** A 2x2 cluster
   ("Join Request Rejected / Join Rejection email sent / Join Request Approved /
   Join Approved Email sent") became a SINGLE box whose words are two notes
   concatenated. Same for "Account Created Signed in", "Gym JOINED Nth…",
   "GYM TRIAL STA…". The operator's own diagnosis is the test to write: such a
   box is about **four times the area of a normal note**, and nothing that far
   off the median should survive as one note.
3. **The word "Legend", handwritten on bare paper, is a note.** It is ink on the
   wall itself, not a sticky. (The words "Gym" and "User" elsewhere on the same
   wall are correctly ignored — so the rule exists, it just does not hold here.)
4. **The cardboard boxes at the bottom left are notes.** The packaging
   ("DS70PLUS-450BL1", "Micro-Stc", the pink tape across it) is brown, roughly
   rectangular, and is being taken for paper.

## Folded in: what the operator saw on photos 2 and 3

Three more screenshots, and the verdict "some of them are quite bad still!!",
"can we please stop detecting the tape? and not miss the stickies that are
super clearly there?", "a single sticky detected as 2 whereas other times it
detects 4 stickies as a single one??". They name the photos by position in the
six; the files are `20260920_201646` (photo 1, the gym wall above),
`20260920_201707` (photo 2) and `20260920_201713` (photo 3).

5. **The size statistic is poisoned, and it breaks splitting BOTH ways.** On
   photo 1 a single note ("ROUTINE STARTED") is chopped into three boxes while
   the 2x2 cluster stays one. Both fall out of one broken number: tape and junk
   enter the population the median note size is measured from, so the median is
   too small — a real note then looks like two notes and is cut, and a genuine
   cluster is so far off the median that the guards refuse to touch it.
6. **Photo 2 is a recall COLLAPSE, on the easiest notes there are.** Dozens of
   large, clearly-lit orange notes are not detected at all ("5 min. Geo
   location DETECTED", "Gym Entered", "Door NFC used", "Session Ended", "GYM
   AUTO LEAVE LEFT", "MACHINE SCANNED (egym)", "Machine Exited tagged", and
   more), while small boxes land on tape. The same build scores well on photo
   1, so the pipeline is OVERFIT to photo 1. Prime suspect: an illumination
   tile mostly covered by one big note measures that NOTE as its wall, and the
   note then fails its own floor.
7. **Tape is being detected everywhere.** Photo 3 strings dozens of tiny boxes
   along the masking-tape runs and the paper seams while whole columns of real
   notes go unboxed. Masking tape is pale yellow — the same family as the
   `aggregate` note (`#fef9c3`) — so hue alone will never separate it. Shape
   and size must: a tape run is long, thin and nothing like a note.
8. **The reader gave up outright on photo 3** ("The reader could not finish
   (ai_error)"), so every box reads "Type the words…". Observed now, not
   suspected.

The bar the operator states: **every sticky boxed exactly once, nothing that is
not a sticky boxed at all.** And the measurement rule that follows from photo 2
being a collapse on a build that suits photo 1: score EVERY labelled photo, and
a change that helps one while wrecking another is not done.

## Why this needs ground truth first

Until now every number has been "how many did we find". That cannot tell a fix
from a regression once false positives are the problem: a change that finds two
more notes and invents five is a loss, and the count goes UP. From here on,
precision and recall are both measured against a hand-labelled truth.

---

## 1. Ground truth and the scoreboard

- [x] 1.1 Hand-label the real stickies in **two** of the six photos: the gym
      wall in the operator's screenshot (densest, has all four defects) and one
      other with a different light. A label is a box (x, y, w, h as fractions of
      the image) plus its kind. Count by eye off the photo.
- [x] 1.2 Store the labels **outside the repo** (e.g.
      `~/.local/share/eswall-truth/<photo>.json`) and document in the plan and
      in `docs/vision/sticky-detection.md` where they live and how to remake
      them. The photos are gitignored because the repo is public; their labels
      describe the same private wall and follow them out.
- [x] 1.3 Extend the calibration sweep to score against a truth file when one
      exists: **precision, recall, F1**, plus the raw lists of MISSED truth
      boxes and SPURIOUS detections (a detection matches a truth box when their
      centres are within half a note and the areas are within 2x).
- [x] 1.4 Record today's numbers for both photos in this plan as the baseline.
      Every task below is judged against them; a task that raises recall while
      dropping precision more is not done.
- [x] 1.5 Commit (sweep changes only — never the photos, never the labels).
- [x] 1.6 Widen the truth set to the operator's photos 2 and 3 (`201707` and
      `201713`) as well: photo 1 alone is what let the detector overfit. Label
      them the same way.
- [x] 1.7 Score and report **per photo**, all three, in one table: precision,
      recall, F1, spurious count, missed count. From here on no task is done on
      an average — every row has to hold.
- [x] 1.8 Commit.

### Baseline, all three labelled photos

| photo                        | notes | found | matched | precision | recall | F1  |
| ---------------------------- | ----- | ----- | ------- | --------- | ------ | --- |
| 20260920_201646 (operator 1) | 47    | 67    | 30      | 45%       | 64%    | 53% |
| 20260920_201707 (operator 2) | 41    | 49    | 4       | 8%        | 10%    | 9%  |
| 20260920_201713 (operator 3) | 56    | 92    | 31      | 34%       | 55%    | 42% |

Photo 2 is worse than the screenshot suggested: FOUR of its forty-one notes
are found. It is not a shade problem or a hard photo - it is the closest,
best-lit, largest-note wall of the three. Whatever is broken there is broken on
the easy case, and the 49 boxes it does draw are almost all on tape and seams.

### Baseline, photo 1 (`20260920_201646`, 47 notes labelled by eye)

| build | found | matched | precision | recall | F1  |
| ----- | ----- | ------- | --------- | ------ | --- |
| today | 67    | 30      | 45%       | 64%    | 53% |

The lists say the same thing the operator did. Missed: the whole 2x2 Join
cluster (4), both ACTOR pairs (4), "App installed" and the note under it, the
pink "Which other systems", and six of the bottom rows. Spurious: a row of
nine boxes along y≈13 (the white ceiling strip ABOVE the paper), one on the ink word "Legend", and thirteen on the cardboard packaging at the bottom
left. Labels live in `~/.local/share/eswall-truth/`, outside this public repo, and
how to remake them is in `docs/vision/sticky-detection.md`.

## 1b. The note size, which is what actually broke

Before any splitting rule is touched: the number those rules divide by.

- [x] 1b.1 Measure `medianNoteSize` per photo against the truth median. Print
      the population it is taken from, and how much of that population is tape
      or junk rather than notes.
- [x] 1b.2 RED: a synthetic wall of notes with two long tape strips across it
      must estimate the same note size as the same wall without them.
- [x] 1b.3 Make the estimate robust: drop obvious non-notes (extreme aspect
      ratio, far off any plausible note area) BEFORE measuring, and iterate —
      estimate, gate, re-estimate — and prefer the MODE of a size histogram to
      a plain median where the population is mixed.
- [x] 1b.4 GREEN, suite green, and the truth table from 1.7 does not regress on
      any photo.
- [x] 1b.5 Commit.

### What the note size actually was, and what broke it

Measured per photo against the hand-labelled median (working size 1000px):

| photo  | note size used | truth | population it came from |
| ------ | -------------- | ----- | ----------------------- |
| 201646 | 50             | 52    | post-close merged blobs |
| 201707 | **24**         | 55    | post-close merged blobs |
| 201713 | **24**         | 38    | post-close merged blobs |

The operator's read was right that the statistic was poisoned, and wrong about
what poisoned it: it is not tape in the population, it is the MORPHOLOGICAL
CLOSE. Its radius is a fraction of the FRAME (6px at 1000px, so it bridges a
12px gap), and photo 2 is a close-up whose notes stand a finger apart - about
10px. The close welded a row of four notes plus the one above them into a
305x278 blob at 30% fill, and the median was then taken from the weld. The
same defect explains both directions of the operator's splitting complaint at
once: at a note size of 24, a real 55px note reads as two notes and is cut,
while a genuine 2x2 cluster is so far off the scale that no rule will touch it.

A pen stroke is a fraction of a NOTE, not of the frame. So the size is now
measured BEFORE anything is fused, from the raw blobs with the obvious
non-notes dropped (min side over the noise floor, fill >= 0.5, aspect <= 2.4),
and the close reaches 4% of THAT. Where no blob looks like a whole note - the
synthetic case where handwriting cuts a note edge to edge - the estimate says
so (0) and the frame-derived radius is used, which is the old behaviour.

| photo  | note size now | truth | F1 before | F1 after |
| ------ | ------------- | ----- | --------- | -------- |
| 201646 | 50            | 52    | 53%       | 63%      |
| 201707 | 49            | 55    | 9%        | **55%**  |
| 201713 | 36            | 38    | 42%       | 57%      |

## 2. Defect 2 first: one note per note

Do this before the false-positive work: a merged 2x2 blob is also four missing
notes, so it pollutes both halves of the scoreboard.

- [x] 2.1 Diagnose why the cluster survives as one blob. The splitter in
      `boxes.ts` only cuts at a **projection valley** and only when the blob is
      "solid"; touching notes of the same colour have at most a thin shadow
      seam, which is probably too shallow to qualify. Write down what you
      measure before changing anything.
- [x] 2.2 RED: a unit test with four same-kind notes touching in a 2x2 block
      (no gap, then a 1px gap, then a faint darker seam) that asserts **four**
      boxes, not one. It must fail today.
- [x] 2.3 Implement size-aware splitting: when a blob's width or height is close
      to an integer multiple of the median note size, divide it into that many
      cells — at the projection valleys when they exist, by equal division when
      they do not. A blob that is 2 notes wide and 2 notes tall yields 4.
- [x] 2.4 Keep the existing guard that a sprawling low-density patch is NOT
      diced into dozens of notes (that regression is recorded in spec/139); the
      new rule applies to blobs that are solid and close to a whole multiple.
- [x] 2.5 GREEN, plus the whole sticky-vision suite, plus the six-photo sweep:
      the merged clusters split, and the F1 from 1.4 improves.
- [ ] 2.6 (deferred to 4.1, which drives all three photos through the editor) Verify in the editor on the operator's photo that
      "Join Request Rejected …" is now four notes with four separate texts.
- [ ] 2.7 Commit.
- [x] 2.8 RED both directions, and pin the hysteresis: a blob within ~1.4x of
      the note size is NEVER cut; ~1.6–2.4x cuts into two; a 2x2 cluster always
      yields four. "ROUTINE STARTED" as one note and the Join cluster as four
      are the same test suite, and neither may be bought with the other.
- [x] 2.9 GREEN, plus the per-photo truth table: the single-note-cut count and
      the merged-cluster count both go down on all three photos.
- [x] 2.10 Commit.

### What the splitter was doing, and what it does now

Diagnosed on photo 1's 2x2 cluster (one box, 100x111, note size 50). The split
rule asked each axis to be long against the note size AND against the box's
OTHER side. A square block of four notes is never long against itself, so it
was never cut - while the same rule on a poisoned note size cut single notes
in half. Both of the operator's complaints, from one line of code.

Three changes:

- **The dead band.** Under 1.67 notes an over-long blob is one note: that is
  not a taste, it is the notation, whose widest silhouette is 127x76mm. Past
  1.8 (that bound plus a margin for the measurement) it is as many notes as it
  is long - the operator's own "four times the area is not one note".
- **One axis at a time, tightening between cuts.** The grid-over-the-bounding-
  box cut halved every note in a SAGGING row, whose bounding box is two notes
  tall. Cutting the longer axis first and tightening each piece onto its own
  paper gets both: a column of a sagging row tightens back to one note and is
  not cut again, a real 2x2 block tightens to a column of two and is.
- **Seam preferred, not required.** A cut lands on the seam between two notes
  when the paper shows one. Requiring a seam was measured and cost 15 points
  of recall: two notes of the same colour flush against each other have no
  boundary in the mask at all, and refusing to cut them is exactly the
  complaint this plan started from.

| photo  | F1 before | F1 now  | recall before | recall now |
| ------ | --------- | ------- | ------------- | ---------- |
| 201646 | 53%       | 68%     | 64%           | **89%**    |
| 201707 | 9%        | **82%** | 10%           | **93%**    |
| 201713 | 42%       | 67%     | 55%           | **93%**    |

Recall is now 89-93% on all three and precision is the remaining problem
(55%, 73%, 53%) - which is Phase 3's job. Photo 1's only misses are the four
small ACTOR notes and a sliver at the frame edge.

## 3. Defects 1, 3, 4: a note is paper, not everything brown

Treat these as one problem — "this region is not a sticky" — with several
independent cues. Add them as gates with measured thresholds, each defended by
the scoreboard, and each in `CALIBRATION`.

- [x] 3.1 Measure first: for every SPURIOUS detection in the two truth photos,
      print its size against the median note, its fill ratio (mask pixels over
      box area), its saturation and value against the paper population, and its
      edge straightness. Find which cues separate junk from notes; do not guess
      a threshold, read it off the distributions.
- [x] 3.2 **Size band.** A note is within a sane multiple of the median note
      (after the splitting from Phase 2). Reject what is far outside it. State
      the band and why in a comment.
- [x] 3.3 **Fill ratio.** A sticky nearly fills its own bounding box; a patch of
      cardboard, tape or wall does not. There is already a `confidence`
      (pixels / area) — promote it to a gate with a measured floor, and keep
      reporting it.
- [x] 3.4 **Neutral guard.** The notation has no white, grey or brown note. A
      region whose saturation sits at or below the WALL population (rather than
      the paper population) is wall, whatever the local floors made of it. This
      is what should kill the white strip above the paper, the shelf, and the
      cardboard.

### What separates a note from junk, measured

Every detection on the three labelled photos, scored against truth and split
into NOTE and JUNK, then described by cue (percentiles):

| cue                         | notes         | junk           |
| --------------------------- | ------------- | -------------- |
| min side / median note      | p10 0.78-0.98 | p50 0.67-0.85  |
| fill (own colour / area)    | p10 0.58-0.73 | p50 0.59-0.67  |
| aspect                      | p90 1.20-1.49 | p75 1.76-1.87  |
| saturation over local floor | p10 0.04-0.05 | p50 -0.04-0.05 |

Two gates came out of it, and the second replaced the planned "neutral guard"
with something stronger:

- **The size band.** Stationery comes in one size. Nine in ten real notes sit
  within a quarter of the photo's median note; half the junk is under three
  quarters of it. A floor at 0.7 (with the existing 2.6 ceiling) cost two real
  notes and took out a third of the junk.
- **A note stands out from the wall it is stuck to** (`src/standout.ts`). Asked
  of the PICTURE, not of the floors: compare the box's inside against the ring
  around it, where the wall is the DULLEST QUARTER of that ring (on a dense
  wall a note's neighbours are other notes, so the ring as a whole is paper).
  Three ways count, and any one is enough, because the eight papers differ
  from a wall differently: more SATURATED (orange on kraft), much BRIGHTER
  relative to the wall (pale yellow), or a different HUE (lilac on brown, and
  only when there is enough colour for a hue to mean anything - a white strip
  of ceiling reports whatever hue its noise felt like). Brightness is measured
  RELATIVELY, because half the light halves an absolute margin: the same
  mistake the frame-wide floors used to make.

Tape, cardboard, the ceiling strip above the paper and the shadow in a paper
seam are all the same colour as their surroundings, so all of them fail it.

| photo  | F1 before | F1 now  | precision before | precision now |
| ------ | --------- | ------- | ---------------- | ------------- |
| 201646 | 68%       | 80%     | 55%              | 73%           |
| 201707 | 82%       | 84%     | 73%              | 83%           |
| 201713 | 67%       | **91%** | 53%              | **91%**       |

- [x] 3.5 **Ink is not paper.** The handwritten "Legend" is ink on bare wall: the
      blob should be mostly ink pixels with wall around them, not a filled field
      of paper colour. Make sure the class mask treats it that way, and that the
      morphological close is not fusing loose ink strokes into a paper-shaped
      blob (it was added to fuse handwriting INSIDE a note; check it is not
      manufacturing notes out of writing on the wall).
- [x] 3.6 Consider, and decide with evidence, whether to keep a low-confidence
      detection at all: the operator sees a box with a tick on it as a claim.
      If a detection cannot clear the gates, it is better absent — the author
      can always drag a box around anything we missed, which is now a
      first-class gesture on the surface.
- [x] 3.7 RED tests for each gate: a white rectangle, a grey/brown cardboard
      rectangle, a word written in ink on bare wall, and a tape strip — none of
      them may become notes, while the eight catalogue notes beside them all do.
- [x] 3.8 GREEN, suite green, sweep re-run: precision up materially on both
      truth photos, recall not down by more than a note or two. Report the table.
- [x] 3.9 Commit.
- [x] 3.10 **Tape.** RED: a masking-tape strip (pale yellow, `#f0ead0`-ish) run
      across a wall of notes, and a second one along a paper seam, produce NO
      boxes — while a real pale-yellow `aggregate` note on the same wall still
      does. Separate them on aspect ratio and size against the note estimate,
      never on hue alone.
- [x] 3.11 **The big-note floor (photo 2's collapse).** RED: a wall where one
      note is larger than an illumination tile must still be detected. Make the
      "a tile that is all one surface must not invent a wall" guard real and
      tested, and report which of photo 2's named missing notes come back.
- [x] 3.12 GREEN, suite green, per-photo truth table for all three photos.
- [x] 3.13 Commit.

### The rest of the gates, and what is left

- **Ink is not paper.** The handwritten "Legend" on the bare wall is gone: ink
  strokes on kraft are duller than the kraft around them, so the standout test
  refuses them without needing a rule of their own. The close is not
  manufacturing a note out of them either - the size floor rejects what it
  does fuse.
- **Paper is BRIGHT** (the veto). Nothing in the notation is darker than the
  wall it is stuck to, so a box darker than the darkest quarter of its own
  ring is not a note - which is what the navy side of the cardboard box was.
  Measured against the DARKEST quarter rather than the middle, or a note in
  the shade gets vetoed for being darker than the sunlit paper beside it.
- **Fill.** Raised from 0.3 to 0.45 of the box. Worth about four points of
  precision on photos 1 and 2 for one or two notes; the cue is weaker than
  either the size band or the standout test, which is why it is a floor rather
  than a gate.
- **Low-confidence detections (3.6).** Kept, and no longer shown as a number:
  the gates above are the judgement, and a box that clears them is a claim the
  detector is willing to make. Confidence stays in the data for the sweep.
- **Still there on photo 1:** the lit tan top of the cardboard packaging and
  the pink parcel tape on it. That photograph has half a room in it, and the
  honest limit stands - fill the frame with the wall.

## 4. The whole wall, end to end

- [ ] 4.1 Re-run all six photos through the editor in a real browser (drop the
      file in; the file dialog's double-click is broken by a Chromium bug on
      this machine). Record detections, precision/recall where truth exists, and
      page errors.
- [ ] 4.2 **PROMOTED — the reader failed outright on photo 3** ("The reader
      could not finish (ai_error)"). Find out with evidence how many crops were
      sent, in how many batches, and what the api worker logged (it logs
      truncation and provider status). Rate limiting and payload size at
      60–100+ crops are the candidates. One failed batch must NOT blank every
      note, and the failure message must say which part failed.
- [ ] 4.2b Check the words: in the operator's screenshot a great many boxes read
      "Type the words…", i.e. the reader returned nothing for them. Find out
      whether that is the junk detections (which will now be gone), a batch
      failing, or the reader being rate-limited at ~66 crops, and fix or report
      it with evidence. A note whose words never arrive is still a note, but
      dozens of them mean something upstream gave up.
- [ ] 4.3 Screenshot each photo's surface and check by eye: boxes on stickies
      and nothing else, words on the right notes, dense clusters separated.
- [ ] 4.4 Post a `shot` of the corrected surface on the operator's gym-wall
      photo, and a `review` with numbered do/expect steps for the whole import.
- [ ] 4.5 Commit.

## 5. Fold-back

- [ ] 5.1 Update spec/139's detector paragraph and its honest-limits list: what
      the gates now reject, and what still fools them.
- [ ] 5.2 Update `docs/vision/sticky-detection.md` (pipeline, constants table,
      "where it still falls over") and `packages/sticky-vision/README.md`.
- [ ] 5.3 Record the final precision/recall table in this plan, next to the
      baseline from 1.4.
- [ ] 5.4 Final gate: format, lint, typecheck, full unit suite, e2e 9/9 with
      `E2E_BASE_URL=http://localhost:3102`, clean build. Tree clean apart from
      the scratch files that belong to another agent (`apps/live/shoot-*.mts`,
      the stray `detect.ts` comment edit).
- [ ] 5.5 Commit.
