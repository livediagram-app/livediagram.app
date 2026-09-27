import { lucideStar } from '@livediagram/icons/lucide';
import { Glyph, Prims } from '@livediagram/ui';
// The palette category-tab glyphs (docs/specs/008-canvas/canvas-and-palette.md), lifted out of
// CommandPalette's tab definitions so the palette file reads as wiring
// rather than ~180 lines of inline SVG. Each is the universal symbol
// for its category, readable at tab size.

export function FavouritesTabIcon() {
  return (
    <Glyph size={18} units={24}>
      {/* A star — the universal favourites mark (the Icons tab
            deliberately uses a smiley instead, so no clash). */}
      <Prims prims={lucideStar} />
    </Glyph>
  );
}

export function ShapesTabIcon() {
  return (
    <Glyph size={18} units={18} strokeLinecap="butt">
      {/* Three distinct shapes (triangle + circle + square)
            in a little cluster: the universal "shapes" symbol,
            readable at a glance. */}
      <path d="M9 2 12.3 7.4 5.7 7.4Z" />
      <circle cx="5.2" cy="12.8" r="2.8" />
      <rect x="10.4" y="10" width="5.6" height="5.6" rx="0.9" />
    </Glyph>
  );
}

// Build (docs/specs/010-palette/build-category.md): a frame with a band across its top and a node hanging off
// it — scaffolding rather than content, which is what this category holds.
export function BuildTabIcon() {
  return (
    <Glyph size={18} units={18} strokeLinecap="butt">
      <rect x="1.6" y="3" width="9.4" height="12" rx="1.2" />
      <path d="M1.6 6.6h9.4" />
      <path d="M11 10.8h2.2" />
      <rect x="13.2" y="8.6" width="3.2" height="4.4" rx="0.9" />
    </Glyph>
  );
}

export function ComponentsTabIcon() {
  return (
    <Glyph size={18} units={18}>
      {/* Stacked blocks — a header bar over a content block — reading
              as "pre-assembled section". */}
      <rect x="2.5" y="2.5" width="13" height="4" rx="1" />
      <rect x="2.5" y="8" width="13" height="7.5" rx="1" />
    </Glyph>
  );
}

// The Data category's glyph (docs/specs/009-elements/pie-chart.md): a bar chart, the most literal picture
// of what the tab holds.
export function DataTabIcon() {
  return (
    <Glyph size={18} units={24} strokeLinejoin="miter">
      <path d="M5 20V10M12 20V4M19 20v-8" />
    </Glyph>
  );
}

// The Behaviour category's glyph (docs/specs/010-palette/palette-top-level-categories.md): a cursor over a target, for the
// elements that DO something when somebody interacts with them.
export function BehaviourTabIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M4 4l6.5 16 2.3-6.6 6.7-2.4z" />
      <path d="M14.5 14.5 20 20" />
    </Glyph>
  );
}

// The Write category's glyph (docs/specs/010-palette/palette-top-level-categories.md): a pen nib over a line of text.
export function WriteTabIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z" />
      <path d="m14.5 5.5 4 4" />
    </Glyph>
  );
}

// The Draw category's glyph (docs/specs/010-palette/palette-top-level-categories.md): a freehand squiggle.
export function DrawTabIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M3 16c3-6 5.5-9 7-9s1.5 4 0 8 1 5 3.5 2 4.5-6 7.5-6" />
    </Glyph>
  );
}

// The Media category's glyph (docs/specs/010-palette/palette-top-level-categories.md): a picture frame, for Image + Avatar.
export function MediaTabIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 16.5 4.5-4 3.5 3 3-2.5 5 4" />
    </Glyph>
  );
}

export function DevicesTabIcon() {
  return (
    <Glyph size={18} units={18}>
      <rect x="2.5" y="3" width="13" height="9" rx="1" />
      <path d="M6.5 15h5M9 12v3" />
    </Glyph>
  );
}

export function IconsTabIcon() {
  return (
    <Glyph size={18} units={24}>
      {/* A smiley glyph reads as "pick an icon" more clearly
            than a star (which implies favourites). */}
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.4 14.5s1.4 1.9 3.6 1.9 3.6-1.9 3.6-1.9" />
      <path d="M9 9.5h.01" />
      <path d="M15 9.5h.01" />
    </Glyph>
  );
}

export function StickersTabIcon() {
  return (
    <Glyph size={18} units={24}>
      {/* A die-cut sticker: a rounded square with its bottom-right
            corner peeled back. The universal "sticker" mark, and
            unmistakable next to the Icons tab's smiley. */}
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V14l-6 7H6.5A2.5 2.5 0 0 1 4 18.5z" />
      <path d="M20 14h-4a2 2 0 0 0-2 2v5" />
    </Glyph>
  );
}

export function TechTabIcon() {
  return (
    <Glyph size={18} units={24}>
      {/* Stacked servers / racks: the universal "infrastructure"
            mark, distinct from the smiley used for line-art icons. */}
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </Glyph>
  );
}

/** Event Storming (docs/specs/021-event-storming/event-storming.md): three tilted sticky notes marching left to
 *  right — the workshop's opening move, matching the template's preview. */
export function EventStormingTabIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="2.5" y="6" width="7" height="7" rx="0.8" transform="rotate(-4 6 9.5)" />
      <rect x="12" y="4.5" width="7" height="7" rx="0.8" transform="rotate(3 15.5 8)" />
      <path d="M4 19h14.5M18.5 19l-2.2-1.6M18.5 19l-2.2 1.6" />
    </Glyph>
  );
}
