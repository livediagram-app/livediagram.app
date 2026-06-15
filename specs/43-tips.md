# 43 — Tips carousel

A discoverability aid: a **Tips** button in the editor footer that opens a
modal **carousel** highlighting features that are powerful but easy to miss.
Many of the editor's affordances live behind right-click menus, keyboard
shortcuts, or the palette, so a first-time (or returning) user can overlook
them. The Tips carousel surfaces them in one friendly place.

## Entry point

- A **lightbulb button** sits in the TabBar's right-side footer cluster,
  immediately to the **right of the keyboard-shortcuts button** (and left of
  Settings). Visible on every viewport (unlike Shortcuts, which hides on
  mobile, tips matter MORE on touch where there is no right-click to discover).
- Clicking it opens the **Tips** modal. `track('UI', 'Opened', 'Tips')` fires
  on open (spec/22).

## The modal

- Standard editor dialog contract (backdrop + click-to-close + Escape, matching
  ShortcutsDialog / SettingsDialog). Centred, `fly-up-in` entrance.
- Inside is a **single-card carousel**: one tip shown at a time as a large
  card with an **illustrative glyph**, a **title**, a one-or-two sentence
  **body**, and an optional **how** hint (the shortcut / gesture that triggers
  it).
- **Navigation**:
  - Prev / Next chevron buttons (Prev disabled on the first card, Next becomes
    a **Done** button on the last).
  - A row of **dots** under the card; clicking a dot jumps to that tip.
  - **Left / Right arrow keys** step between cards.
  - **Touch swipe** (horizontal pointer drag past a threshold) steps between
    cards, so it works well on mobile.
- **Responsive**: fixed comfortable width on desktop; near-full-width
  (`max-w-[92%]`) on mobile. The card art scales down on small screens.

## Tips (initial set)

Ordered most-broadly-useful first. The list lives in one array in the
component, so adding a tip is a one-line change.

1. **Keyboard shortcuts** — there's a full set; open the shortcuts dialog.
2. **Search panel** — jump to any diagram, tab, or element; search across the
   whole workspace.
3. **Right-click / long-press** — every element and the canvas has a context
   menu (right-click on desktop, press-and-hold on touch).
4. **Frames** — group related shapes in a labelled section that moves
   together; great for swimlanes / zones.
5. **Teams** — share a workspace with teammates (Admin / Member roles, email
   invites).
6. **Session tools** — run a timer or a dot-vote with everyone on the tab
   (facilitation for live sessions).
7. Plus other hard-to-find features (pencil / freehand, comments, templates +
   themes, quick-connect arrows, multi-select + format painter, embeds). The
   array can grow without UI changes.

## Non-goals

- Not a guided/interactive product tour (no canvas overlays or step gating).
- Not shown automatically; it is user-invoked from the footer. (The first-run
  welcome modal is separate, spec/14.)
