# Reading the handwriting: readers measured

Which reader can turn a sticky-note crop into words, measured on one real wall
(spec/139 Phase 8/9). The detector found 32 crops in the operator's kraft-wall
photo; 24 were labelled by eye (verbatim, casing as written) and 4 were
labelled blank (two pieces of tape, the photographer's two shoes). Every reader
got the same crops, cut exactly as `apps/live/lib/photo-detect.ts` cuts them.

Scoring is case- and punctuation-insensitive: **exact** is whole notes read
perfectly, **words** is the share of true words present in the answer, **CER**
is character error rate, **blanks wrong** is how many of the four empty crops
got invented text.

| Reader                                    | Runs where                | Download  | exact                                      | words | CER  | blanks wrong     | time / crop                      |
| ----------------------------------------- | ------------------------- | --------- | ------------------------------------------ | ----- | ---- | ---------------- | -------------------------------- |
| Tesseract.js (shipped, `lib/ocr.ts`)      | browser, WASM             | ~15 MB    | 1/24                                       | 17%   | 57%  | 4/4              | 0.05 s                           |
| TrOCR-small-handwritten (q8 and fp32)     | browser                   | ~60 MB    | 0/24                                       | 1%    | >100 | 4/4              | 0.5 s                            |
| Florence-2-base-ft `<OCR>`                | browser                   | ~330 MB   | 0/24                                       | 8%    | 21%  | 4/4              | 3.5 s                            |
| SmolVLM-256M-Instruct q4                  | browser                   | ~190 MB   | 13/24                                      | 78%   | 15%  | 0/4 (says "No.") | 7 s WASM 1-thread · 0.5 s WebGPU |
| SmolVLM-256M-Instruct q4, image splitting | browser                   | ~190 MB   | 16/24                                      | 81%   | 10%  | 0/4              | ~4× the above                    |
| SmolVLM-500M-Instruct q4                  | browser                   | ~360 MB   | 17/24                                      | 82%   | 13%  | 0/4              | ~14 s WASM 1-thread              |
| Qwen2.5-VL-7B Q4_K_M, llama.cpp, RTX 4090 | self-hosted `AI_BASE_URL` | 5 GB once | 22/24                                      | 96%   | 3.7% | 0/4              | 0.25 s                           |
| Gemini 2.5 Flash-Lite / gpt-5-nano / etc. | cloud via `AI_BASE_URL`   | none      | not measured (no key on the bench machine) |       |      |                  | ~$0.001 per 40-note wall         |

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
  zero at workshop volumes. Quality was not measured here.

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

## Reproducing

The bench lived in a scratch folder (`/tmp/ocr-bench`) with its own
`package.json` so nothing leaked into the repo: `crop.mts` cuts crops with the
real detector, `truth.json` is the hand labelling, `score.mts` scores,
`bench-*.mts` are one per reader, `browser.html` + Playwright for the in-browser
runs. Real photographs never enter the repo.
