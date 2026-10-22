import {
  ACCENT_BAR_TEXT,
  CARD_TAG_MAX,
  PAGE_HEADING_MAX,
  cardLayout,
  cardMediaOf,
  cardSlotsOf,
  colorWash,
  labelOn,
  type CardMedia,
  type LayoutRect,
  TAG_CHIP_WASH,
  tagColourOf,
} from '@livedesign/document';
import { GlyphDisc } from '@livedesign/ui';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import { isTechIconId } from '@/lib/tech-icons';
import { useTagColours } from '@/components/canvas/TagColoursContext';

// The card's media (docs/specs/009-elements/card.md "The slots"): a badge disc, a soft tile, or an initial.
function CardMediaArt({
  media,
  rect,
  iconId,
  accent,
  badgeInk,
  title,
  fontFamily,
}: {
  media: CardMedia;
  rect: LayoutRect;
  iconId: string | undefined;
  accent: string;
  // What a badge's glyph is drawn in: white on the accent disc, the band's colour on a band.
  badgeInk: string;
  title: string;
  fontFamily: string | undefined;
}) {
  const d = rect.width;
  const at = { left: rect.x, top: rect.y };
  if (media === 'tile' && iconId && isTechIconId(iconId)) {
    return (
      <svg
        aria-hidden
        className="pointer-events-none absolute"
        style={at}
        width={d}
        height={d}
        viewBox="0 0 24 24"
      >
        <TechIconArt iconId={iconId} sizePx={d} />
      </svg>
    );
  }
  if (media === 'tile') {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute flex items-center justify-center"
        style={{
          ...at,
          width: d,
          height: d,
          borderRadius: d * 0.24,
          backgroundColor: colorWash(accent, 0.16),
        }}
      >
        <span className="relative" style={{ width: d * 0.6, height: d * 0.6 }}>
          <IconGlyph iconId={iconId ?? 'image'} stroke={accent} />
        </span>
      </div>
    );
  }
  const badge = media === 'badge';
  return (
    <GlyphDisc
      as="div"
      size={d}
      aria-hidden
      className="pointer-events-none absolute font-bold"
      style={{
        ...at,
        backgroundColor: badge ? accent : colorWash(accent, 0.16),
        color: badge ? badgeInk : accent,
        fontSize: badge ? d / 2 : d * 0.42,
        fontFamily,
      }}
    >
      {badge && iconId ? (
        <span className="relative" style={{ width: d * 0.56, height: d * 0.56 }}>
          <IconGlyph iconId={iconId} stroke={badgeInk} />
        </span>
      ) : badge ? (
        'i'
      ) : (
        (title.trim()[0] ?? '?').toUpperCase()
      )}
    </GlyphDisc>
  );
}

// The card (docs/specs/009-elements/card.md): the ordinary bordered box, and in it the slots placed by cardLayout
// (the same numbers the export draws with). The title, meta line and tags edit in place once the card is selected;
// the body is the element's label. A callout not yet migrated draws here as the badge card it becomes.
export function CardFace({
  element,
  labelNode,
  accent,
  textColor,
  fontFamily,
  editable,
  onSetRows,
  onSetHeading,
}: WebFaceProps) {
  const zoom = useCanvasZoom();
  const l = cardLayout(element.width, element.height, cardSlotsOf(element));
  const media = cardMediaOf(element);
  const tags = element.tags ?? [];
  const tagColours = useTagColours();
  const bandText = l.band
    ? element.headerFill
      ? labelOn(element.headerFill)
      : ACCENT_BAR_TEXT
    : textColor;
  const editTag = (i: number, v: string) =>
    onSetRows({ tags: tags.map((t, j) => (j === i ? v : t)) });
  return (
    <>
      {l.band ? (
        // Clipped by the card's own corner (inherited radius), so the band takes the top corners.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: 'inherit' }}
        >
          <div
            className="absolute inset-x-0 top-0"
            style={{ height: l.band.height, backgroundColor: element.headerFill ?? accent }}
          />
        </div>
      ) : null}
      {l.media && media ? (
        <CardMediaArt
          media={media}
          rect={l.media}
          iconId={element.iconId}
          // On the header band the accent is the ground, so the media takes the band's text colour instead.
          accent={l.band ? bandText : accent}
          badgeInk={l.band ? (element.headerFill ?? accent) : ACCENT_BAR_TEXT}
          title={element.pageTitle ?? ''}
          fontFamily={fontFamily}
        />
      ) : null}
      {l.title ? (
        <div className="absolute flex items-center" style={{ ...rectStyle(l.title), fontFamily }}>
          <InlineTextLine
            value={element.pageTitle ?? ''}
            placeholder="Title"
            editable={editable}
            onCommit={(v) => onSetHeading('pageTitle', v)}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate font-semibold leading-snug"
            style={{ color: bandText, fontSize: l.titlePx }}
            ariaLabel="Card title"
          />
        </div>
      ) : null}
      {l.meta ? (
        <div
          className={`absolute flex items-center ${l.band ? 'justify-end' : ''}`}
          style={{ ...rectStyle(l.meta), fontFamily }}
        >
          <InlineTextLine
            value={element.pageSubtitle ?? ''}
            placeholder="Meta line"
            editable={editable}
            onCommit={(v) => onSetHeading('pageSubtitle', v)}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate leading-snug"
            style={{ color: bandText, fontSize: l.metaPx, opacity: 0.7 }}
            ariaLabel="Card meta line"
          />
        </div>
      ) : null}
      <LabelRegion rect={l.body}>{labelNode}</LabelRegion>
      {l.tags.map((t, i) => {
        // A mapped tag's chip in its colour (docs/specs/009-elements/tag-colours.md).
        const tagged = tagColourOf(tagColours, t.text);
        const wash = tagged ? colorWash(tagged, TAG_CHIP_WASH) : colorWash(accent, 0.1);
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full border"
            data-tag-colour={tagged ?? undefined}
            style={{
              ...rectStyle(t.rect),
              backgroundColor: wash,
              borderColor: tagged ?? colorWash(accent, 0.35),
              fontFamily,
            }}
          >
            <InlineTextLine
              value={t.text}
              placeholder="Tag"
              editable={editable}
              onCommit={(v) => editTag(i, v)}
              zoom={zoom}
              maxLength={CARD_TAG_MAX}
              className="whitespace-nowrap leading-none"
              style={{
                color: tagged ?? textColor,
                fontSize: l.tagPx,
                opacity: tagged ? 1 : 0.85,
              }}
              ariaLabel={`Tag ${i + 1}`}
            />
          </div>
        );
      })}
    </>
  );
}
