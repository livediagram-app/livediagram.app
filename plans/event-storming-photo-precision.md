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

## Why this needs ground truth first

Until now every number has been "how many did we find". That cannot tell a fix
from a regression once false positives are the problem: a change that finds two
more notes and invents five is a loss, and the count goes UP. From here on,
precision and recall are both measured against a hand-labelled truth.

---

## 1. Ground truth and the scoreboard

- [ ] 1.1 Hand-label the real stickies in **two** of the six photos: the gym
      wall in the operator's screenshot (densest, has all four defects) and one
      other with a different light. A label is a box (x, y, w, h as fractions of
      the image) plus its kind. Count by eye off the photo.
- [ ] 1.2 Store the labels **outside the repo** (e.g.
      `~/.local/share/eswall-truth/<photo>.json`) and document in the plan and
      in `docs/vision/sticky-detection.md` where they live and how to remake
      them. The photos are gitignored because the repo is public; their labels
      describe the same private wall and follow them out.
- [ ] 1.3 Extend the calibration sweep to score against a truth file when one
      exists: **precision, recall, F1**, plus the raw lists of MISSED truth
      boxes and SPURIOUS detections (a detection matches a truth box when their
      centres are within half a note and the areas are within 2x).
- [ ] 1.4 Record today's numbers for both photos in this plan as the baseline.
      Every task below is judged against them; a task that raises recall while
      dropping precision more is not done.
- [ ] 1.5 Commit (sweep changes only — never the photos, never the labels).

## 2. Defect 2 first: one note per note

Do this before the false-positive work: a merged 2x2 blob is also four missing
notes, so it pollutes both halves of the scoreboard.

- [ ] 2.1 Diagnose why the cluster survives as one blob. The splitter in
      `boxes.ts` only cuts at a **projection valley** and only when the blob is
      "solid"; touching notes of the same colour have at most a thin shadow
      seam, which is probably too shallow to qualify. Write down what you
      measure before changing anything.
- [ ] 2.2 RED: a unit test with four same-kind notes touching in a 2x2 block
      (no gap, then a 1px gap, then a faint darker seam) that asserts **four**
      boxes, not one. It must fail today.
- [ ] 2.3 Implement size-aware splitting: when a blob's width or height is close
      to an integer multiple of the median note size, divide it into that many
      cells — at the projection valleys when they exist, by equal division when
      they do not. A blob that is 2 notes wide and 2 notes tall yields 4.
- [ ] 2.4 Keep the existing guard that a sprawling low-density patch is NOT
      diced into dozens of notes (that regression is recorded in spec/139); the
      new rule applies to blobs that are solid and close to a whole multiple.
- [ ] 2.5 GREEN, plus the whole sticky-vision suite, plus the six-photo sweep:
      the merged clusters split, and the F1 from 1.4 improves.
- [ ] 2.6 Verify in the editor on the operator's photo that
      "Join Request Rejected …" is now four notes with four separate texts.
- [ ] 2.7 Commit.

## 3. Defects 1, 3, 4: a note is paper, not everything brown

Treat these as one problem — "this region is not a sticky" — with several
independent cues. Add them as gates with measured thresholds, each defended by
the scoreboard, and each in `CALIBRATION`.

- [ ] 3.1 Measure first: for every SPURIOUS detection in the two truth photos,
      print its size against the median note, its fill ratio (mask pixels over
      box area), its saturation and value against the paper population, and its
      edge straightness. Find which cues separate junk from notes; do not guess
      a threshold, read it off the distributions.
- [ ] 3.2 **Size band.** A note is within a sane multiple of the median note
      (after the splitting from Phase 2). Reject what is far outside it. State
      the band and why in a comment.
- [ ] 3.3 **Fill ratio.** A sticky nearly fills its own bounding box; a patch of
      cardboard, tape or wall does not. There is already a `confidence`
      (pixels / area) — promote it to a gate with a measured floor, and keep
      reporting it.
- [ ] 3.4 **Neutral guard.** The notation has no white, grey or brown note. A
      region whose saturation sits at or below the WALL population (rather than
      the paper population) is wall, whatever the local floors made of it. This
      is what should kill the white strip above the paper, the shelf, and the
      cardboard.
- [ ] 3.5 **Ink is not paper.** The handwritten "Legend" is ink on bare wall: the
      blob should be mostly ink pixels with wall around them, not a filled field
      of paper colour. Make sure the class mask treats it that way, and that the
      morphological close is not fusing loose ink strokes into a paper-shaped
      blob (it was added to fuse handwriting INSIDE a note; check it is not
      manufacturing notes out of writing on the wall).
- [ ] 3.6 Consider, and decide with evidence, whether to keep a low-confidence
      detection at all: the operator sees a box with a tick on it as a claim.
      If a detection cannot clear the gates, it is better absent — the author
      can always drag a box around anything we missed, which is now a
      first-class gesture on the surface.
- [ ] 3.7 RED tests for each gate: a white rectangle, a grey/brown cardboard
      rectangle, a word written in ink on bare wall, and a tape strip — none of
      them may become notes, while the eight catalogue notes beside them all do.
- [ ] 3.8 GREEN, suite green, sweep re-run: precision up materially on both
      truth photos, recall not down by more than a note or two. Report the table.
- [ ] 3.9 Commit.

## 4. The whole wall, end to end

- [ ] 4.1 Re-run all six photos through the editor in a real browser (drop the
      file in; the file dialog's double-click is broken by a Chromium bug on
      this machine). Record detections, precision/recall where truth exists, and
      page errors.
- [ ] 4.2 Check the words: in the operator's screenshot a great many boxes read
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
