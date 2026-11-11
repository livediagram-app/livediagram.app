// An element's indicators (docs/specs/008-canvas/element-indicators.md): its link, note, action and
// comments. Drawn INSIDE the element's
// outline in the person's style, Top (quiet glyphs near the top) or Footer (a labelled
// row along the bottom), or as the pip on the outline when the element has no room for either.
//
// Glyphs take the element's own text colour (inherited `currentColor`) at rest opacity, so they
// suit any fill, theme or preset; hover raises them. Commands stay hidden until hover, with their
// space reserved so nothing moves. Selecting the element fades the whole cluster away (its own
// selection chrome takes those edges) until it is deselected. Like the other adornments they
// scale with the canvas and hide below ADORNMENT_MIN_ZOOM.
import {
  ActionIcon,
  CommentIcon,
  GlyphDisc,
  HoverCard,
  LinkIcon,
  NoteIcon,
  IDENTITY_FILL,
  identityVars,
} from '@livehuddle/ui';
import type { BoxedElement } from '@livehuddle/document';
import { badgeCornerInset } from '@liveworkspace/workbench/lib/badge-anchor';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ADORNMENT_MIN_ZOOM } from '@/components/canvas/element-badges';
import type { IndicatorLayout } from '@/components/canvas/useIndicatorLayout';
import {
  TOP_BACKING_PAD_PX,
  FOOTER_PAD_PX,
  FOOTER_ROW_PX,
  clusterSize,
  type IndicatorItem,
  type IndicatorKind,
} from './indicator-items';

// A corner this round or rounder gets a fully round pip; sharper ones a softly squared pip.
const ROUND_PIP_FROM_PX = 10;

// Resting glyphs are a cue, not text; hovering the element raises them, the pointer's glyph to 1.
// Spelled out in full so Tailwind sees each class.
const TONE = 'opacity-50 group-hover/el:opacity-85';
// While the element is selected its handles, "+" buttons and toolbar crowd the same edges, so the
// whole cluster shrinks and fades out of the way (micro, docs/specs/004-interface-design/motion.md)
// and comes back on deselect. `inert` takes the hidden buttons out of the tab order too. Each
// state names its own pointer-events, so the two never sit on one element to fight over order.
const SHOWN = 'pointer-events-auto transition';
const SELECTED_HIDDEN = 'pointer-events-none scale-75 opacity-0 transition';

// The pip's height: h-[22px] below.
const PIP_HEIGHT_PX = 22;

// The pip's point on the outline, inset from the element's top-right corner: where its centre sits.
function pipInsetOf(
  element: BoxedElement,
  placed: IndicatorLayout,
  cornerPx: number,
): { x: number; y: number } {
  const shape = element.type === 'shape' ? element.shape : undefined;
  return placed.pip ?? badgeCornerInset(shape, element.width, element.height, cornerPx);
}

/** The box the cluster takes, in the element's own units from its top-left corner: from the same placement and sizes
 *  the cluster draws itself with, so whatever keeps clear of it (a retired element's Delete,
 *  docs/specs/002-project-scope/not-in-livehuddle.md "Deleting it") keeps clear of what is drawn. */
export function indicatorClusterRect(
  element: BoxedElement,
  items: readonly IndicatorItem[],
  placed: IndicatorLayout,
  cornerPx: number,
): { x: number; y: number; width: number; height: number } | null {
  if (items.length === 0) return null;
  if (placed.form === 'pip' || !placed.box) {
    const inset = pipInsetOf(element, placed, cornerPx);
    // The pip's buttons are the Top form's (h-5 min-w-5 and a count), in a px-0.5 backing.
    const width = clusterSize(items, 'top').width;
    const cx = element.width - inset.x;
    return { x: cx - width / 2, y: inset.y - PIP_HEIGHT_PX / 2, width, height: PIP_HEIGHT_PX };
  }
  const { box } = placed;
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: placed.form === 'top' ? box.height : FOOTER_ROW_PX,
  };
}

const GLYPHS: Record<IndicatorKind, typeof NoteIcon> = {
  link: LinkIcon,
  note: NoteIcon,
  action: ActionIcon,
  comment: CommentIcon,
};

export function ElementIndicators({
  element,
  items,
  placed,
  cornerPx,
  fill,
  selected,
}: {
  element: BoxedElement;
  items: IndicatorItem[];
  // Where the cluster goes, from useIndicatorLayout (the content reads it too).
  placed: IndicatorLayout;
  // The element's drawn corner radius, which the outline and the pip follow.
  cornerPx: number;
  // The element's fill, as the backing that masks a label running under the glyphs; undefined
  // when the element has no visible fill.
  fill?: string;
  selected: boolean;
}) {
  const zoom = useCanvasZoom();
  if (items.length === 0 || zoom < ADORNMENT_MIN_ZOOM) return null;

  let position: React.CSSProperties;
  let shapeClass: string;
  let glyphPx: number;
  if (placed.form === 'pip' || !placed.box) {
    const inset = pipInsetOf(element, placed, cornerPx);
    const round = cornerPx >= ROUND_PIP_FROM_PX;
    position = { right: inset.x, top: inset.y, transform: 'translate(50%, -50%)' };
    shapeClass = `h-[22px] px-0.5 ring-1 ring-current/15 ${round ? 'rounded-full' : 'rounded-md'} ${
      fill ? '' : 'bg-white dark:bg-slate-800'
    }`;
    glyphPx = 11;
  } else if (placed.form === 'top') {
    const { box } = placed;
    position = { left: box.x, top: box.y, height: box.height, padding: TOP_BACKING_PAD_PX };
    shapeClass = 'rounded';
    glyphPx = 14;
  } else {
    const { box } = placed;
    position = { left: box.x, top: box.y, height: FOOTER_ROW_PX, paddingInline: FOOTER_PAD_PX };
    shapeClass = 'gap-2.5 rounded text-[11px] font-medium leading-none';
    glyphPx = 12;
  }
  const words =
    placed.form === 'footer'
      ? 'labelled'
      : placed.form === 'footer-compact'
        ? 'compact'
        : undefined;

  return (
    <div
      data-indicators={placed.form}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ ...position, backgroundColor: fill }}
      inert={selected}
      className={`absolute flex items-center ${shapeClass} ${selected ? SELECTED_HIDDEN : SHOWN}`}
    >
      {/* Glyph buttons only: the comment count inside one is already optically centred. */}
      {items.map((item) => (
        <IndicatorButton key={item.kind} item={item} size={glyphPx} footer={words} />
      ))}
    </div>
  );
}

function IndicatorButton({
  item,
  size,
  footer,
}: {
  item: IndicatorItem;
  size: number;
  footer?: 'labelled' | 'compact';
}) {
  const Glyph = GLYPHS[item.kind];
  const extra = item.dataAttr ? { [item.dataAttr]: '' } : {};
  const lead =
    footer && item.assignee ? (
      <GlyphDisc
        size={16}
        as="span"
        aria-hidden
        style={identityVars(item.assignee.color)}
        className={`text-[8px] font-semibold text-white ${IDENTITY_FILL}`}
      >
        {item.assignee.initials}
      </GlyphDisc>
    ) : (
      <Glyph size={size} />
    );
  const button = (
    <button
      type="button"
      aria-label={item.label}
      onClick={(e) => {
        e.stopPropagation();
        item.onClick();
      }}
      className={`flex items-center rounded transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-current ${
        footer ? 'h-5 gap-1' : 'h-5 min-w-5 justify-center gap-0.5 px-[3px]'
      } ${TONE}`}
      {...extra}
    >
      {lead}
      {item.count ? (
        <span className="text-[11px] font-semibold tabular-nums leading-none">
          <span className="text-optical-centre">{item.count}</span>
        </span>
      ) : footer === 'labelled' && item.word ? (
        <span>{item.word}</span>
      ) : null}
    </button>
  );
  return item.hoverCard ? (
    <HoverCard title={item.hoverCard.title} description={item.hoverCard.description}>
      {button}
    </HoverCard>
  ) : (
    button
  );
}
