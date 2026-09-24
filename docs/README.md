# Docs

Documentation for livediagram, the open-source real-time diagram editor.

These docs are the practical guide: what the app does, how to run it locally, how to host it on your own Cloudflare account, and how to contribute. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](../specs/). Specs are normative; these docs explain.

## Contents

| Doc                                                        | Covers                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [What is livediagram?](what-is-livediagram.md)             | The product: what it does, who it's for, what's built and what's still ahead.                                                                    |
| [Architecture](architecture.md)                            | The repo shape: seven apps, thirteen packages, the Cloudflare-only deployment model.                                                             |
| [Local development](local-development.md)                  | Clone, install, run all apps locally, scope commands to a single workspace.                                                                      |
| [Self-hosting](self-hosting.md)                            | Run your own copy on Cloudflare Workers + D1. Optional Clerk auth.                                                                               |
| [Contributing](contributing.md)                            | How to propose changes: specs-first workflow, code style, tests, PR expectations.                                                                |
| [Sticky detection](vision/sticky-detection.md)             | How a photograph of a wall becomes sticky notes: the pipeline, its constants, its limits.                                                        |
| [Handwriting readers](vision/handwriting-readers.md)       | Which reader can read marker handwriting on a sticky crop: Tesseract, TrOCR, Florence-2, SmolVLM, Qwen-VL and cloud, measured on one real wall.  |
| [Boundary model experiment](vision/experiments/e-model.md) | Whether a tiny learned model trained on synthetic walls finds stickies better than the classical pipeline, measured on the eight labelled walls. |
| [Resolution](vision/experiments/d-resolution.md)           | Whether more pixels per note (a bigger working image, or tiles) help the sticky detector: measured, and why 1000px stays.                        |

## How docs relate to specs

- **Docs** (this folder): user-facing + contributor-facing instructions. How to do things.
- **[Specs](../specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## License

[MIT](../LICENSE). Self-host, fork, embed, modify, commercial or otherwise. The hosted version at [livediagram.app](https://livediagram.app) runs alongside the open-source codebase; see [What is livediagram?](what-is-livediagram.md) for the OSS / hosted split.
