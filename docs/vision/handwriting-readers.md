# Reading the handwriting: readers measured

Which reader can turn a sticky-note crop into words, measured on one real wall
(spec/139 Phase 8/9). The detector found 32 crops in the operator's kraft-wall
photo; 24 were labelled by eye (verbatim, casing as written) and 4 were
labelled blank (two pieces of tape, the photographer's two shoes). Every reader
got the same crops, cut exactly as `apps/live/lib/photo-detect.ts` cuts them.

**What shipped** (spec/139 Phase 9): the reader is pluggable. A model configured
on the api reads the crops — Google defaults to `gemini-2.5-flash-lite` for this
route, the cheapest tier and, measured here, also the most accurate. With no
model configured the browser reads them with SmolVLM-256M, which keeps the photo
import working with no key at all. Detection is in-browser either way.

Scoring is case- and punctuation-insensitive: **exact** is whole notes read
perfectly, **words** is the share of true words present in the answer, **CER**
is character error rate, **blanks wrong** is how many of the four empty crops
got invented text.

| Reader                                            | Runs where                  | Download  | exact | words | CER  | blanks wrong     | time / crop                      |
| ------------------------------------------------- | --------------------------- | --------- | ----- | ----- | ---- | ---------------- | -------------------------------- |
| Tesseract.js (was shipped, now removed)           | browser, WASM               | ~15 MB    | 1/24  | 17%   | 57%  | 4/4              | 0.05 s                           |
| TrOCR-small-handwritten (q8 and fp32)             | browser                     | ~60 MB    | 0/24  | 1%    | >100 | 4/4              | 0.5 s                            |
| Florence-2-base-ft `<OCR>`                        | browser                     | ~330 MB   | 0/24  | 8%    | 21%  | 4/4              | 3.5 s                            |
| SmolVLM-256M-Instruct q4                          | browser                     | ~190 MB   | 13/24 | 78%   | 15%  | 0/4 (says "No.") | 7 s WASM 1-thread · 0.5 s WebGPU |
| SmolVLM-256M-Instruct q4, image splitting         | browser                     | ~190 MB   | 16/24 | 81%   | 10%  | 0/4              | ~4× the above                    |
| SmolVLM-500M-Instruct q4                          | browser                     | ~360 MB   | 17/24 | 82%   | 13%  | 0/4              | ~14 s WASM 1-thread              |
| Qwen2.5-VL-7B Q4_K_M, llama.cpp, RTX 4090         | self-hosted `AI_BASE_URL`   | 5 GB once | 22/24 | 96%   | 3.7% | 0/4              | 0.25 s                           |
| **gemini-2.5-flash-lite**, batched 6              | cloud (hosted default tier) | none      | 23/24 | 99%   | 0.2% | 0/4              | 0.2 s (5.9 s for the wall)       |
| gemini-3.6-flash, batched 6 (the assistant model) | cloud                       | none      | 22/24 | 95%   | 1.1% | 0/4              | 0.9 s (26 s for the wall)        |

Cloud readings are measured through the worker's OWN request shape (its prompt,
`response_format: json_object`, six crops per call), so the numbers describe
what ships rather than a friendlier harness.

Readings that count as "wrong" on Qwen-7B were `preparation` for
`preparations` and `describ`/`proff` for strokes that are genuinely ambiguous
in the photo.

## What the numbers say

- **Tesseract cannot do this job.** It is a printed-text model; on marker
  handwriting it reads one note in 24 and invents words on every blank crop
  (the shoes read as `s065 onclled`). The review's editable text is doing all
  the work today.
- **Line OCR models (TrOCR) are the wrong shape.** Trained on single lines of
  IAM English; a sticky is two to four lines on coloured paper. Even with a
  projection-based line split they score nothing.
- **Florence-2's OCR task runs words together** (`classcanceled`), so a decent
  character rate is useless for note text.
- **A small vision-language model is the first thing that works in the
  browser.** SmolVLM-256M goes from 17% to ~80% of words with a 190 MB
  download; 500M adds a little. Both are prompt-sensitive: a tighter "reply
  with nothing else" prompt made the 500M model drop whole lines (82% → 70%),
  and image splitting (higher-resolution tiles) made it answer for one tile.
  Keep the plain prompt; handle blanks by the model's own consistent "No."
  answer, and let the review overlay catch the rest.
- **A 7B VLM on a consumer GPU is near-perfect and free per call**, through
  the existing `POST /api/ai/read-notes` route with `AI_BASE_URL` pointed at a
  llama.cpp server. This is the cheapest "very good" option for anyone with a
  GPU (or patience: it runs on CPU too).
- **Cloud is a rounding error in cost.** On the cheap vision tier
  (Gemini Flash-Lite, gpt-5-nano, Qwen-VL-8B) a crop is ~300 prompt tokens and
  ~20 out, so a 40-note wall is a tenth of a cent; Google's free tier makes it
  zero at workshop volumes.
- **The cheapest cloud model is also the most accurate one here.**
  `gemini-2.5-flash-lite` reads 99% of the words at 0.2% CER, beating
  `gemini-3.6-flash` (95% / 1.1%) while being about four times cheaper per token
  and four times faster on the same wall. Reading a sticky is a narrow, literal
  task, and the reasoning a bigger model adds is spent on a job that does not
  need it. `AI_VISION_MODEL` exists precisely so the read path can differ from
  the assistant's model.
- **Budget headroom is not optional with a thinking model.** Reasoning tokens
  come out of `max_tokens`: at 300 for six crops `gemini-3.6-flash` returns
  half-written JSON with `finish_reason: "length"`, which looks exactly like a
  malformed answer. The worker's 2000 is comfortable (~100-250 completion tokens
  per batch of six), and it now logs the cut-off by name rather than calling it
  unparseable.

## Guarding the in-browser reader against invention

The table above was one wall without every word known. Two walls now carry
the true words of 86 notes (at most eight words each, 95% five or fewer), and
`apps/live/scripts/reader-bench.mts` scores the in-browser reader on them
through the editor's own `readOne` (same prompt, same q4 weights, node CPU
standing in for WASM). SmolVLM-256M at the size the photo gives: 37/86 exact,
60% of words, CER 27%, and 17 answers that are mostly not the note.

Invention has two causes, and each has a guard (spec/139 Phase 9):

- **A note too small to read.** Each crop shrunk to a given short edge,
  counting answers within 30% CER of the truth ("useful") against answers
  over 60% ("invented"):

  | short edge | full | 128 | 96  | 64  | 56  | 48  | 40  | 32  | 24  |
  | ---------- | ---- | --- | --- | --- | --- | --- | --- | --- | --- |
  | exact      | 37   | 38  | 32  | 23  | 14  | 10  | 3   | 1   | 0   |
  | useful     | 57   | 58  | 51  | 40  | 33  | 24  | 8   | 2   | 0   |
  | invented   | 13   | 11  | 9   | 17  | 11  | 26  | 28  | 42  | 5   |

  48 px is the crossing, so a crop whose short edge is under 48 px is not
  asked about (`READ_MIN_EDGE_PX`, `apps/live/lib/reading/floor.ts`). A
  whiteboard shot from across the room puts every note at 12-41 px, which is
  where the browser reader answered "The answer is 1.", "Yes." and the like on
  every note; with the floor the whole wall is left unread in 12 seconds
  instead of half an hour, and the review's unread tip suggests a closer
  photo. (At 24 px the model mostly answers nothing at all: it is the band
  just above that invents.)

- **An answer shaped like chat.** "Yes.", "I'm not.", "The text is written in
  black marker.": a bare yes / no / sure, an opener that talks about the
  picture or itself, or more than twelve words leaves the note unread
  (`apps/live/lib/reading/answer.ts`). It flags none of the 86 true notes and
  takes no correct reading away; on full-size crops it turns 4 of the 17
  inventions into unread notes (and 5 of 16 at 128 px).

Neither guard applies to the hosted reader, which does not invent this way.

## Browser feasibility, honestly

- transformers.js runs SmolVLM in **WASM** correctly (matches the Node
  numbers). Single-threaded it is ~7 s per crop for 256M; threads need the
  page to be cross-origin isolated (COOP/COEP headers), which is a whole-app
  decision because it affects every iframe and third-party script.
- **WebGPU** loads in ~5-9 s and reads in ~0.5 s per crop, but on this Linux /
  NVIDIA / Vulkan box Dawn does not expose `shader-f16`, and with the fp32
  vision encoder the decoder never sees the image (every answer is "No
  writing"). HF's own SmolVLM-WebGPU demo relies on f16, which Chrome exposes
  on Windows and macOS. Unverified here; treat WebGPU as an accelerator with a
  WASM fallback, never as the only path.
- The model must be fetched once (190-360 MB) and cached (Cache Storage);
  first use on a phone over mobile data is the cost to design around.

## When to revisit this

The in-browser number is the one that will move: small vision-language models
are improving fast, and the gap measured here (~80% in the browser against 99%
from a hosted model) is the whole reason the reader is pluggable rather than
fixed. This page exists so that the next look is a MEASUREMENT against the same
wall, not a fresh argument from first principles.

Worth re-running when any of these is true:

- A sub-500MB VLM claims handwriting ability (the size ceiling is the phone
  download, not the accuracy).
- transformers.js or ONNX Runtime ships a WebGPU release that no longer needs
  `shader-f16`, or Chrome exposes it on Linux/NVIDIA — that unblocks the 14x
  speed-up and changes the 200-second wall into a 15-second one.
- A browser ships a built-in multimodal model (Chrome's Prompt API and friends)
  that a page may use without downloading weights itself.
- The hosted reader's provider changes its cheap tier — the cheapest model being
  the most accurate one is a happy accident of this moment, not a law.

What would actually change the shipped decision: an in-browser reader within a
few points of the hosted one, at a download a phone will tolerate. At that point
the server path becomes the fallback rather than the default, and the photo
import stops needing a key for full quality.

## Reproducing

`scripts/read-bench.mts` is the loop, kept in the repo precisely so this is
cheap to redo:

```sh
# First run: cuts the crops with the REAL detector and writes a skeleton to label
pnpm bench:readers --photo ~/wall.png --truth ~/wall-truth.json

# Fill in each note's words by eye from the crops it wrote ("" for a blank one),
# then score any OpenAI-compatible reader against them:
GOOGLE_AI_STUDIO_API_KEY=... pnpm bench:readers \
  --photo ~/wall.png --truth ~/wall-truth.json --model gemini-2.5-flash-lite

# A local llama.cpp, or anything else that speaks the same wire:
pnpm bench:readers --photo ~/wall.png --truth ~/wall-truth.json \
  --base http://127.0.0.1:4271/v1 --model qwen2.5-vl-7b --key-var NONE
```

It cuts crops at the resolution production uses, sends them through the api
worker's own prompt and request shape (six per call, JSON mode, the same token
budget), and appends a scored row to `read-bench-results.md` beside the truth
file. Labels are keyed by each note's POSITION rather than its index, because an
index silently rots the moment the detector finds one sticky more than last time
— which is exactly the run where you are trying to learn whether something
helped. A label that matches no detection is reported, not quietly scored.

In-browser readers are scored in node against the labelled walls, through the
editor's own reading code:

```sh
cd apps/live
npx tsx scripts/reader-bench.mts --reader smolvlm-256m --set words [--edge 48]
npx tsx scripts/reader-bench-score.mts /tmp/reader-bench-*.json
```

`--set words` is the notes with true words, `--set tiny` a whiteboard of
notes too small for any reader, `--edge N` shrinks every crop to an N px short
edge. The words stay in `/tmp`; only numbers are printed. Speed is measured IN
a browser (node cannot stand in for WebGPU): point a Playwright run at the
editor with no model configured on the api, or with `E2E_AI_BUDGET_SPENT=1`.

Real photographs never enter the repo — keep the wall PNG and its labels
outside it.
