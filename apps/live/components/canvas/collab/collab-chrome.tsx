// Shared chrome for the collaboration panels (spec/123 to spec/129): the card
// title, the small press targets, and the empty-state line.
//
// Five faces render the same card — a title over a body over a control row —
// so the frame lives here once. Without it each face re-types the same four
// class strings and they drift the first time one is tweaked.

import { SHAPE_DEFAULT_SIZE, type ShapeElement } from '@livediagram/diagram';
import { tint } from '@/lib/element-tint';
// Re-exported: every collab face already reaches for it through this module,
// and the kit it now also feeds lives one level up (see lib/element-tint.ts).
export { tint };
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { Tooltip } from '@/components/primitives/Tooltip';

// Scales a Collaborate card's contents to the element's box (spec/122).
//
// The face is laid out at the kind's default size and then scaled, rather
// than reflowed. That is the difference between "the card gets bigger" and
// "the card gets more padding": a fist-of-five stretched to fill a wide box
// still has 13px type and 6px bars, which is exactly what you cannot read from
// across a room.
//
// Uniform scale on the smaller axis, so nothing distorts and nothing spills.
// The design box is the shape's default size, which is what every face was
// composed against. Along the OTHER axis the inner box is stretched to cover
// the whole element (in design units), so a card taller or wider than its
// default still paints its backdrop edge to edge: a centred design-sized box
// left the agenda's ruling and crease floating in a band in the middle of a
// tall element, with bare card above and below.
function CollabScale({ element, children }: { element: ShapeElement; children: React.ReactNode }) {
  const design = SHAPE_DEFAULT_SIZE[element.shape];
  const scale = Math.min(element.width / design.width, element.height / design.height);
  return (
    // Pinned with `absolute inset-0` rather than `h-full w-full`: `h-full`
    // plus padding only stays inside the box under border-box sizing, and when
    // it does not the footer buttons paint OUTSIDE the element.
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
      <div
        style={{
          // The element's box in design units: one axis is exactly the design
          // size, the other is whatever the element has, so the transform maps
          // the inner box onto the real one with nothing left over.
          width: element.width / scale,
          height: element.height / scale,
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function CollabPanel({
  element,
  title,
  textColor,
  aside,
  titleLines = 1,
  children,
  footer,
  className,
  headerExtra,
  backdrop,
  overlay,
  inset,
}: {
  // The element, for its box. A Collaborate card SCALES to the space it is
  // given rather than laying out into it: resizing one is how a facilitator
  // makes it readable from the back of the room, and a card that only grew its
  // padding did nothing for them. See the wrapper below.
  element: ShapeElement;
  // The element's own label — the question, the prompt, the session name.
  title: string;
  // How many lines the title may take before it clamps. One for a caption-ish
  // prompt; more where the label is a sentence (a decision statement).
  titleLines?: number;
  textColor: string;
  // Small right-aligned status beside the title ("4 of 6 in", "1h 5m").
  aside?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Extra class on the card body. Used by the Done check (spec/137) for its
  // all-done flash, which is a class rather than an inline style so the
  // reduced-motion override in globals.css can reach it.
  className?: string;
  // A control pinned to the right of the title row, after `aside`. The Done
  // check's ellipsis menu lives here; a card with no per-card controls passes
  // nothing and the row is unchanged.
  headerExtra?: React.ReactNode;
  // The paper kit (spec/122): the textures that make this card a particular
  // OBJECT rather than a generic rounded rectangle. `backdrop` prints UNDER
  // the content — rules, a halftone screen, a punched margin — and `overlay`
  // over it, for the pieces that have to sit on top of everything: a folded
  // corner, a strip of tape, a torn edge.
  //
  // Two slots rather than one because the layering is the effect. Rules under
  // the words read as a page they are written on; the same rules over them
  // read as a cage.
  backdrop?: React.ReactNode;
  overlay?: React.ReactNode;
  // Extra room reserved at the edges for whatever the two slots draw, so a
  // punched margin does not print through the title and a torn edge does not
  // eat the footer.
  inset?: { left?: number; bottom?: number; top?: number };
}) {
  return (
    // Pinned with `absolute inset-0` rather than sized with `h-full w-full`,
    // and clipped to the element's own corner radius.
    //
    // `h-full` + padding only stays inside the box under border-box sizing, and
    // when it doesn't the footer buttons paint OUTSIDE the element — half a
    // "Add" pill hanging over the border. `inset-0` pins to the box whatever
    // the sizing model, and `overflow-hidden` makes it impossible for any
    // future child to escape the element it belongs to.
    <CollabScale element={element}>
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        {backdrop}
        <div
          className={`relative flex h-full w-full flex-col gap-2.5 overflow-hidden rounded-[inherit] px-4 py-3.5 ${className ?? ''}`}
          style={{
            paddingLeft: inset?.left !== undefined ? 16 + inset.left : undefined,
            paddingBottom: inset?.bottom !== undefined ? 14 + inset.bottom : undefined,
            paddingTop: inset?.top !== undefined ? 14 + inset.top : undefined,
          }}
        >
          <div className="flex min-w-0 shrink-0 items-baseline justify-between gap-3">
            <span
              className="min-w-0 text-[13px] font-semibold leading-snug"
              style={{
                color: textColor,
                // A clamp rather than a truncate: the overflow has to be bounded
                // (the header is shrink-0, so an unbounded title would push the
                // body out of the card) but a one-line decision statement is
                // useless.
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: titleLines,
                overflow: 'hidden',
              }}
            >
              {title.trim()}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {aside ? (
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.06em] opacity-55"
                  style={{ color: textColor }}
                >
                  {aside}
                </span>
              ) : null}
              {headerExtra}
            </span>
          </div>
          {/* The body scrolls rather than overflowing the element box: a card with
          twelve agenda rows on it is a normal card, and clipping the last few
          with no way to reach them is the bug that would report.

          The negative margin + matching padding buys 4px of interior room
          before the scroller clips, without moving anything: a participant
          avatar draws its presence ring as a box-shadow OUTSIDE its own box,
          and `overflow` clipped a slice off every ring. */}
          <div className="-mx-1 -my-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 py-1">
            {children}
          </div>
          {footer ? <div className="flex shrink-0 flex-wrap gap-2 pt-0.5">{footer}</div> : null}
        </div>
        {overlay}
      </div>
    </CollabScale>
  );
}

// A small pill button. `tone` picks the weight: 'quiet' for the secondary act
// (Clear, Stand), 'loud' for the one the card is for (Reveal, Take roll).
export function CollabButton({
  children,
  onPress,
  disabled,
  tone = 'quiet',
  textColor,
  label,
  tooltip,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'quiet' | 'loud';
  textColor: string;
  // Accessible name where the visible text is a glyph or too terse.
  label?: string;
  tooltip?: { title: string; description: string };
}) {
  // The canvas-wide press guard: a press that turns into a drag moves the
  // element instead of firing (every other on-canvas control uses it).
  const press = usePressWithoutDrag(() => onPress?.());
  const button = (
    <button
      type="button"
      {...press}
      disabled={disabled || !onPress}
      aria-label={label}
      className="pointer-events-auto shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-default disabled:opacity-45"
      style={{ color: textColor, backgroundColor: tint(textColor, tone === 'loud' ? 0.16 : 0.08) }}
    >
      {children}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip title={tooltip.title} description={tooltip.description}>
      {button}
    </Tooltip>
  );
}

// One value in a row of pickable options (an estimate chip, a 1-5 reading).
// `mine` is the raised state: your own answer, which you can always see even
// when everybody else's is hidden.
export function CollabChip({
  value,
  mine,
  onPress,
  disabled,
  textColor,
}: {
  value: string;
  mine: boolean;
  onPress?: () => void;
  disabled?: boolean;
  textColor: string;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  return (
    <button
      type="button"
      {...press}
      disabled={disabled || !onPress}
      aria-pressed={mine}
      aria-label={`Choose ${value}`}
      className="pointer-events-auto min-w-[34px] shrink-0 cursor-pointer rounded-lg border px-2 py-1.5 text-[13px] font-semibold tabular-nums transition hover:brightness-95 disabled:cursor-default disabled:opacity-45"
      style={{
        color: textColor,
        backgroundColor: tint(textColor, mine ? 0.2 : 0.05),
        borderColor: tint(textColor, mine ? 0 : 0.14),
      }}
    >
      {value}
    </button>
  );
}

// The line a card shows before anything has happened to it. Deliberately a
// sentence rather than a zero: an average of 0 on an unanswered temperature
// check reads as a very unhappy room (spec/124).
export function CollabEmpty({ children, textColor }: { children: string; textColor: string }) {
  return (
    <p className="py-1 text-[11px] leading-relaxed opacity-55" style={{ color: textColor }}>
      {children}
    </p>
  );
}
