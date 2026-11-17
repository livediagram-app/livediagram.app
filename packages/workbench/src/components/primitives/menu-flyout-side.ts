// Which side a desktop flyout opens on (docs/specs/008-canvas/canvas-and-palette.md "A flyout can hold a
// flyout"). A flyout in the host menu prefers the right. A nested one prefers the side its PARENT opened to:
// each flyout used to pick alone, so when Tools flipped left the space to the right of its Mind Map row was the
// host menu itself, and the third panel opened over it.
//
// The other side is measured past the whole open chain (the host menu and every flyout above this one), not
// past the trigger row, because beside the row on the far side sits the parent. Only when neither side fits
// does the panel open beside its row on the roomier side and let the caller's clamp overlap what it must.

export type FlyoutSide = 'left' | 'right';

// The horizontal span of a box on screen.
export type Span = { left: number; right: number };

export function flyoutSide({
  trigger,
  chain,
  width,
  viewportWidth,
  prefer,
  margin,
  gap,
}: {
  // The trigger row.
  trigger: Span;
  // Every open menu above this flyout (null for a flyout in the host menu: its row spans that menu).
  chain: Span | null;
  // The panel's own width.
  width: number;
  viewportWidth: number;
  prefer: FlyoutSide;
  margin: number;
  gap: number;
}): { side: FlyoutSide; left: number } {
  const besideRight = trigger.right + gap;
  const besideLeft = trigger.left - gap - width;
  const fits = (left: number) => left >= margin && left + width + margin <= viewportWidth;
  const besideTheRow = prefer === 'right' ? besideRight : besideLeft;
  if (fits(besideTheRow)) return { side: prefer, left: besideTheRow };
  // Crossing over: clear the whole chain, which on that side of the row is the parent and the host menu.
  const other: FlyoutSide = prefer === 'right' ? 'left' : 'right';
  const span = chain
    ? { left: Math.min(chain.left, trigger.left), right: Math.max(chain.right, trigger.right) }
    : trigger;
  const across = other === 'right' ? span.right + gap : span.left - gap - width;
  if (fits(across)) return { side: other, left: across };
  // Neither fits: open beside the row on whichever side has more room, and let the viewport clamp decide the
  // overlap (the least of it).
  const roomRight = viewportWidth - margin - besideRight;
  const roomLeft = trigger.left - gap - margin;
  return roomRight >= roomLeft
    ? { side: 'right', left: besideRight }
    : { side: 'left', left: besideLeft };
}
