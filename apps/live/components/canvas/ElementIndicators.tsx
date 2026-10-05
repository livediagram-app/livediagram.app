// An element's indicators (docs/specs/008-canvas/element-indicators.md): its link, note, action and
// comments, plus a mind root's Edit Outline and Tidy Map commands. Drawn INSIDE the element's
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
  MindOutlineIcon,
  NoteIcon,
  TidyMapIcon,
} from '@livediagram/ui';
import type { BoxedElement } from '@livediagram/document';
import { badgeCornerInset } from '@/lib/badge-anchor';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import { ADORNMENT_MIN_ZOOM } from '@/components/canvas/element-badges';
import type { IndicatorLayout } from '@/components/canvas/useIndicatorLayout';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import {
  TOP_BACKING_PAD_PX,
  FOOTER_PAD_PX,
  FOOTER_ROW_PX,
  type IndicatorItem,
  type IndicatorKind,
} from './indicator-items';

// A corner this round or rounder gets a fully round pip; sharper ones a softly squared pip.
const ROUND_PIP_FROM_PX = 10;

// Resting glyphs are a cue, not text; hover or selection raises them, the pointer's glyph to 1.
// Spelled out in full so Tailwind sees each class.
const REST = 'opacity-50';
const HOVER_ACTIVE = 'group-hover/el:opacity-85';
const COMMAND_HIDDEN = 'invisible group-hover/el:visible';
// While the element is selected its handles, "+" buttons and toolbar crowd the same edges, so the
// whole cluster shrinks and fades out of the way (micro, docs/specs/004-interface-design/motion.md)
// and comes back on deselect. `inert` takes the hidden buttons out of the tab order too.
const SHOWN = 'transition';
const SELECTED_HIDDEN = 'transition pointer-events-none scale-75 opacity-0';

const GLYPHS: Record<IndicatorKind, typeof NoteIcon> = {
  outline: MindOutlineIcon,
  tidy: TidyMapIcon,
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
  // Where the cluster goes, from useIndicatorLayout (the label reads it too).
  placed: IndicatorLayout;
  // The element's drawn corner radius, which the outline and the pip follow.
  cornerPx: number;
  // The element's fill, as the backing that masks a label running under the glyphs; undefined
  // when the element has no visible fill.
  fill?: string;
  selected: boolean;
}) {
  const zoom = useCanvasZoom();
  const shape = element.type === 'shape' ? element.shape : undefined;
  if (items.length === 0 || zoom < ADORNMENT_MIN_ZOOM) return null;

  const tone = `${REST} ${HOVER_ACTIVE}`;
  const shown = selected ? SELECTED_HIDDEN : SHOWN;
  const ordered =
    placed.form === 'footer' || placed.form === 'footer-compact'
      ? [...items.filter((i) => !i.command), ...items.filter((i) => i.command)]
      : items;

  if (placed.form === 'pip' || !placed.box) {
    const inset = placed.pip ?? badgeCornerInset(shape, element.width, element.height, cornerPx);
    // Glyph buttons only: the comment count inside one is already optically centred.
    const pipGlyphs = ordered.map((item) => (
      <IndicatorButton key={item.kind} item={item} tone={tone} size={11} />
    ));
    const round = shape === 'circle' || shape === 'stadium' || cornerPx >= ROUND_PIP_FROM_PX;
    return (
      <div
        data-indicators="pip"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          right: inset.x,
          top: inset.y,
          transform: 'translate(50%, -50%)',
          backgroundColor: fill,
        }}
        inert={selected}
        className={`pointer-events-auto absolute flex h-[22px] items-center px-0.5 ring-1 ring-current/15 ${shown} ${
          fill ? '' : 'bg-white dark:bg-slate-800'
        } ${round ? 'rounded-full' : 'rounded-md'}`}
      >
        {pipGlyphs}
      </div>
    );
  }

  const { box } = placed;
  if (placed.form === 'top') {
    return (
      <div
        data-indicators="top"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          left: box.x,
          top: box.y,
          height: box.height,
          padding: TOP_BACKING_PAD_PX,
          backgroundColor: fill,
        }}
        inert={selected}
        className={`pointer-events-auto absolute flex items-center rounded ${shown}`}
      >
        {ordered.map((item) => (
          <IndicatorButton key={item.kind} item={item} tone={tone} size={14} />
        ))}
      </div>
    );
  }

  const compact = placed.form === 'footer-compact';
  return (
    <div
      data-indicators={placed.form}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        left: box.x,
        top: box.y,
        height: FOOTER_ROW_PX,
        paddingInline: FOOTER_PAD_PX,
        backgroundColor: fill,
      }}
      inert={selected}
      className={`pointer-events-auto absolute flex items-center gap-2.5 rounded text-[11px] font-medium leading-none ${shown}`}
    >
      {ordered.map((item) => (
        <IndicatorButton
          key={item.kind}
          item={item}
          tone={tone}

          size={12}
          footer={compact ? 'compact' : 'labelled'}
        />
      ))}
    </div>
  );
}

function IndicatorButton({
  item,
  tone,
  size,
  footer,
}: {
  item: IndicatorItem;
  tone: string;
  size: number;
  footer?: 'labelled' | 'compact';
}) {
  const Glyph = GLYPHS[item.kind];
  const extra = item.dataAttr ? { [item.dataAttr]: '' } : {};
  const hidden = item.command ? COMMAND_HIDDEN : '';
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
      } ${tone} ${hidden}`}
      {...extra}
    >
      {lead}
      {item.count ? (
        <span className="text-[11px] font-semibold tabular-nums leading-none">
          <span className="text-optical-centre">{item.count}</span>
        </span>
      ) : footer === 'labelled' && item.word && !item.command ? (
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
