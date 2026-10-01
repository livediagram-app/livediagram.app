# Hero environment preview

Status: draft (spike)

## What

The hero's three ways to start, **Drawing**, **Diagram** and **Brainstorm**
([Marketing site](marketing-site.md) "Hero"), show where they lead before they are chosen. Pointing
at one turns the hero's backdrop into that environment, behind the headline and the buttons. Moving
to another button swaps the environment. Moving away from the buttons brings the homepage back.
Clicking a button commits: the buttons and the headline step aside, and the environment that was
already showing becomes the page.

## Stages

The hero is in exactly one stage at a time.

| Stage        | What shows                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `idle`       | The homepage hero as today: headline, lead, buttons, the six-window stage                              |
| `previewing` | One environment fills the hero behind the copy, under a soft scrim; the six-window stage fades out     |
| `launching`  | The buttons and the copy leave, the environment takes the full hero, its chrome arrives, then it opens |

- **Into a preview.** A mouse resting on a button, or keyboard focus landing on one, previews its
  environment. A pointer that only passes over the row on its way elsewhere previews nothing: the
  first preview waits for an intent delay of 120ms.
- **Between previews.** Once previewing, moving to another button swaps environments at once. The
  swap is a crossfade that reverses smoothly from wherever it is, so sweeping across all three never
  stutters.
- **Out of a preview.** Leaving the buttons, by pointer and by focus, returns to `idle` after a grace
  delay of 200ms, so crossing the gap between two buttons keeps the preview.
- **Launching.** A plain click on a button launches its environment. A modified click (new tab, new
  window) is the browser's and follows the link untouched. A launch is one-way: no hover or leave
  undoes it. It ends on the button's own link, measured as today ([Landing funnel](landing-funnel.md)).
- **Back.** A back/forward-cache restore returns the hero to `idle`.

## Environments

Each button's environment is the place its link opens:

| Button     | Opens                      | Environment                                         |
| ---------- | -------------------------- | --------------------------------------------------- |
| Drawing    | `/new?template=whiteboard` | A blank whiteboard with a pen in hand               |
| Diagram    | `/new`                     | The New Document wizard with its template catalogue |
| Brainstorm | `/new?browse=brainstorm`   | The wizard opened on the Brainstorm collection      |

Environments are prepared ahead of need: the first time a pointer or focus enters the buttons, all
three are rendered hidden, so the first preview has nothing to load.

**Open question.** What draws an environment is not decided (see "Open questions"). The spike draws
each one from the marketing site's own parts: a dotted canvas with a pen stroke for Drawing, and the
template catalogue's own preview art for the wizard environments.

## Motion

- The crossfade between environments and back to the homepage runs at the `short` token (200ms).
- The launch is content, paced as the hero's own entrance ([Motion](../004-interface-design/motion.md)
  "Content pacing"): the buttons and copy leave in about 250ms, and the environment's chrome then
  cascades in on the shared cascade step. The link opens once the cascade has settled.
- Every value lives in the content stylesheet `app/hero-preview.css`.
- Reduced motion keeps the previews, and makes every swap instant. A launch under reduced motion opens
  the link at once.

## Touch and small screens

A touch has no hover, so a tap is a plain click: it launches. Below `sm`, where the buttons stack
and the hero has no room behind them, there is no preview and a tap opens the link directly.

## Accessibility

- The environments are decorative and hidden from assistive technology; the buttons stay links with
  their names unchanged.
- Keyboard focus previews as a hover does, and Escape returns to `idle`.
- The copy stays at full strength over a scrim in the page colour, so it keeps its 4.5:1 contrast.

## Open questions

- **What draws an environment.** Four options were raised:
  - **iframe** the editor's real page in a read-only preview mode.
  - **Extract** a read-only document renderer into `packages/` and render it here.
  - **Prerender** the editor with Speculation Rules, and hand over with a cross-document view
    transition on click.
  - **Static** art from the marketing site's own parts (what the spike does).
- **Whether a launch hands over seamlessly.** Today the marketing site and the editor are separate
  apps, so a launch ends in a page load. Only the prerender option removes it.
