# Plan: every sticky, once — 95% on every wall

Spec: [spec/139](../specs/139-event-storming.md) Phase 9 (detection, review,
reader). Docs: [sticky detection](../docs/vision/sticky-detection.md),
[handwriting readers](../docs/vision/handwriting-readers.md). Previous plans:
[precision](event-storming-photo-precision.md) (done), and the tuning pass
recorded in the spec (total F1 80.8 → 83.7 on 647 hand-traced notes).

Truth: the private `livediagram-app/vision-model-truths` repository —
eight photographs, 647 notes traced by hand in the review surface. The sweep
(`packages/sticky-vision/scripts/calibrate.ts`) scores every change against
it, per wall and in total.

## The bar (the operator's words, made measurable)

- **Detection: 95% on every wall.** Recall ≥ 95% on each of the eight
  labelled photographs — the shaded one (201730) and the night one (201743)
  included — AND precision ≥ 95%, so the recall is not bought with junk.
- **No merged stickies.** Zero detections whose box holds the centres of two
  or more labelled notes, on every wall.
- **Actors are the one allowance.** The small yellow actor stickies may fall
  short of 95% if chasing them costs the others; every other kind must meet
  the bar. Actor recall is reported separately so the allowance is visible.
- **The whiteboard (274 notes) is detected in full even when its words are
  not read.** Detection and reading are judged separately.
- **When ≥ 10% of the notes could not be read**, the review says so, politely,
  and offers the author the choice: take a better photo, or type the words in.
  Never decided for them.
- **Free for everyone, by default.** No model that costs money to host for
  every visitor; no subscription; no sign-up. A paid or local "higher
  quality" path (MCP into Claude Code / pi, a CLI) may exist as an OPTION,
  never as the default.
- **Photos stay private** (spec/139): detection runs in the browser; only
  crops of individual notes are ever sent, and only to read them.
- **Nothing licensed incompatibly with MIT** ships in the product (AGPL
  models and runtimes, for instance, cannot).

## Phase 1 — research: every technique worth trying

Fifty-four research agents, in nine themes of six angles, each searching the
web and writing one report to `research/event-storming-vision/<slug>.md`
(working notes, not committed). Each report ends with ranked candidates:
what, evidence it would help OUR failure modes, cost to run for free, licence,
bundle size, effort, and links.

- [x] 1.1 Spawn the nine themes (see "Research themes" below), 54 angles.
- [x] 1.2 While they run: extend the sweep with the bar's own measures —
      per-wall recall and precision, merged-box count, actor recall
      separately, and a PASS/FAIL line against the bar. Commit.
- [ ] 1.3 Collect all 54 reports; chase any that failed or came back thin.
      (34 in; 20 hit the Antigravity quota and re-spawn automatically after it
      resets, with a 21st angle on evaluating the reader.)
- [x] 1.4 Synthesise `docs/vision/research.md`: the inventory of techniques,
      models and methods, de-duplicated, each scored for fit, cost, licence,
      size and expected gain against our measured failure modes. Commit.

### Where it starts, against the bar

| wall             | prec | rec-A | actors | merged | bar     |
| ---------------- | ---- | ----- | ------ | ------ | ------- |
| 201646           | 76%  | 90%   | 3/7    | 4      | FAIL    |
| 201654           | 98%  | 94%   | 0/2    | 4      | FAIL    |
| 201707           | 79%  | 83%   | 0/0    | 2      | FAIL    |
| 201713           | 89%  | 94%   | 0/0    | 0      | FAIL    |
| 201730 (shade)   | 90%  | 88%   | 0/1    | 2      | FAIL    |
| 201743 (night)   | 36%  | 54%   | 0/2    | 1      | FAIL    |
| wall-panorama    | 85%  | 62%   | 23/36  | 10     | FAIL    |
| whiteboard-dense | 96%  | 86%   | 18/19  | 17     | FAIL    |
| **total**        | 85%  |       |        | **40** | **0/8** |

## Phase 2 — the unread tip (product, independent of detection)

- [x] 2.1 Spec it in spec/139: the threshold (≥ 10% unread), the copy, the two
      choices, where it sits (a floating pill: zero layout shift).
- [x] 2.2 RED tests, then build it; e2e; commit.

## Phase 3 — the experiment plan

- [x] 3.1 From the inventory, write `plans/event-storming-photo-95-experiments.md`:
      every experiment as a checkbox, grouped so groups can run in PARALLEL
      without touching the same files, each with its hypothesis, the measure
      that decides it, and the bar it must not break.
- [x] 3.2 Commit it.

## Phase 4 — delegated experiments

- [x] 4.1 Delegate each experiment group to its own session (Opus 5.5,
      medium effort), each in its OWN git worktree and branch, so parallel
      work cannot collide. Every delegate scores against the same truth with
      the same sweep, and reports its table.
- [ ] 4.2 Supervise: answer questions, unblock, reject anything that breaks a
      guard test or lowers any wall.
- [ ] 4.3 Merge the winners onto this branch, one at a time, re-scoring after
      each merge (improvements interact).
- [ ] 4.4 Iterate until the bar is met on every wall, or until a wall is shown
      — with evidence — to be beyond what a photograph of it can give, in
      which case that is recorded as a limit with the numbers.

## Phase 5 — optional higher-quality paths

- [ ] 5.1 Spec an MCP / CLI path (Claude Code, pi): hand the photo to the
      author's own model for detection or reading, as an OPTION.
- [ ] 5.2 Build it if the research shows it earns its keep; the default path
      stays free.

## Phase 6 — verify and fold back

- [ ] 6.1 Browser run on all eight photos; screenshots on the wall.
- [ ] 6.2 Full gate: format, lint, typecheck, unit, e2e, build.
- [ ] 6.3 Fold back into spec/139, `docs/vision/*`, the package README, the
      help centre; record the final table here.

## Research themes (Phase 1)

1. `classical-cv` — segmentation and separation of touching objects with
   classical computer vision.
2. `browser-models` — small instance-segmentation / detection models that
   run in a browser, free.
3. `prior-art` — who has already solved sticky-note capture, and how.
4. `training` — training or fine-tuning a small detector of our own:
   data, synthetic data, cost, licences.
5. `runtime` — what can run in a browser or on a free tier, and how fast.
6. `reading` — free handwriting reading, and photo-quality checks.
7. `separation` — shape priors: fitting rectangles and quadrilaterals, and
   cutting merged blobs.
8. `light` — shade, glare, white balance, perspective, capture guidance.
9. `method` — evaluation with little data, VLM grounding, and the MCP / CLI
   upquality path.
