# 31 — Presentation mode

Status: **draft** (open questions below need answers before implementation).

Turn the current diagram into a slideshow. The presenter steps through the diagram one "step" at a time; elements appear as the presentation advances, and an element's note (the existing `note?: string` field, see [spec/05](05-diagram-structure.md)) is shown when its element comes up. Built for the "walk someone through this diagram on a call or a projector" moment.

## Why

A finished diagram shows everything at once, which is great for reference but bad for narration. Presenters today zoom around manually with the laser pointer. Presentation mode gives the build-up story for free: reveal nodes in order, with the author's notes as the narration track.

## Reveal model

Presentation mode is a **progressive reveal**, not a camera tour:

- The presentation starts with an empty canvas (tab background, pattern, and theme intact).
- Each **step** reveals one more unit of the diagram. Already-revealed elements stay visible.
- The camera animates to fit the revealed-so-far bounding box (reusing `computeFitToScreen` in `apps/live/lib/viewport.ts`), biased toward the newly revealed element so the audience's eye lands on it. The newly revealed element gets a brief entrance emphasis (fade/scale in).
- Stepping **backward** hides the most recent step again and re-fits.

## What counts as a step

Derived automatically from the diagram; nothing is authored per-slide in v1.

- One **boxed element** (shape, text, sticky, image, table, freehand) = one step, in `tab.elements` array order (creation order, which is also z-order).
- Elements sharing a `groupId` reveal together as **one step**, at the position of the group's earliest member.
- **Arrows are not their own step.** An arrow reveals automatically as soon as both of its endpoints are revealed (a floating arrow with no boxed endpoints reveals with the step it follows in array order).
- Resolved-or-not **comment threads never render** in presentation mode; they are collaboration metadata, not content.
- Locked elements present like any other element.

## Notes

- When a step's element has a `note`, the note text renders in a **caption panel** (bottom of the screen, theme-styled, scrollable if long). No note, no panel.
- Notes are shown to whoever is looking at the screen. There is no separate presenter-only notes view in v1 (see open questions).

## Entry, controls, exit

- Enter via a **Present** action: zoom-dock button next to the zen-mode toggle, command palette entry, and a keyboard shortcut (proposed `Shift+P`; plain `P` is risky next to existing single-key tool shortcuts).
- Presentation mode implies the **zen-mode chrome treatment** ([spec/26](26-zen-mode.md)): all panels, header, tab bar, and palette hidden. Additionally the canvas becomes non-interactive for editing (no selection, no drag, no palette), regardless of the user's role.
- Advance: `→`, `Space`, `Page Down`, or click. Back: `←`, `Page Up`. `Home`/`End` jump to first/last step. `Esc` exits and restores the prior viewport and chrome.
- A minimal HUD shows step position (`7 / 23`) and exit hint, fading out when idle.
- Request browser fullscreen on entry where available; exiting fullscreen exits the mode.
- Available to every role, including share-link `view` sessions: presenting is read-only by nature, and a viewer narrating a shared diagram is a core use case.

## Scope of a presentation

- v1 presents the **current tab only**. Advancing past the last step shows an "end of presentation" state; one more advance (or `Esc`) exits. Multi-tab traversal is an open question.

## Persistence and schema

- **No schema changes in v1.** Step order is derived (array order + groups), so nothing new is stored on elements, tabs, or diagrams, and self-hosted data is untouched.
- Presentation mode is transient client state, like zen mode. It is never persisted and never written to the change log.

## Realtime

- v1 is **local-only**: entering presentation mode broadcasts nothing, and remote collaborators' cursors/lasers are hidden from the presenter's view while presenting (they would puncture the illusion of a clean slideshow).
- Remote edits arriving mid-presentation are applied to the underlying tab but elements beyond the current step stay hidden; a newly added element simply becomes a future step.
- "Follow the presenter" (a `presentation` room op so viewers' screens sync to the presenter's step) is a natural v2 and would slot into the presence-op family (`cursor`, `select`, `laser`, `tab-focus`) in `@livediagram/api-schema`. Out of scope for v1.

## Implementation shape

Per the no-god-files rule: a `usePresentation.ts` hook (step list derivation, current index, keyboard handling, camera targets) plus a `PresentationOverlay.tsx` component (HUD, caption panel, end state), composed into the editor with minimal edits to `useEditorState.ts` / `EditorView.tsx`. Step-derivation logic (pure: `Element[]` in, ordered steps out) lives beside the element helpers in `packages/diagram` so it is testable and reusable.

## Telemetry

Per [spec/22](22-telemetry.md): `track('UI', 'Opened', 'Presentation')` on entry and `track('UI', 'Closed', 'Presentation')` on exit. `Presentation` is a new telemetry type value; categories and actions already cover `UI` / `Opened` / `Closed`. No per-step events (too chatty, low signal).

## Out of scope (v1)

- Authored slide order or named slides.
- Presenter-only notes view / dual-screen presenter console.
- Multi-tab presentations.
- Follow-the-presenter sync.
- Export to PDF/PPT.

## Open questions

1. **Step order**: is creation order (array order) good enough for v1, or do real diagrams get built out of narration order often enough that we need an explicit per-element order (e.g. an optional `presentIndex?: number`, with a reorder UI) before this is useful?
2. **Reveal vs tour**: progressive reveal is specced as the default. Should a "camera tour" variant (everything visible, camera flies node to node) exist as a toggle, or is one model enough?
3. **Notes on screen**: notes render as an audience-visible caption. Is that right, or are notes the presenter's private script (which implies a presenter console and makes v1 much bigger)?
4. **Multi-tab**: should advancing past a tab's last step continue into the next tab (respecting tab folders, [spec/30](30-tab-folders.md)), or stay single-tab?
5. **Arrows**: reveal-with-endpoints is specced. Alternative: arrows as their own steps so the presenter can narrate the relationship, not just the nodes. Which matches how you present?
