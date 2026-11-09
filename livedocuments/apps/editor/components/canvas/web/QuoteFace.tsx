import { labelFontPx } from '@liveworkspace/model-core/label-font';
import {
  BORDER_RADIUS_PX,
  PAGE_HEADING_MAX,
  QUOTE_MARK,
  colorWash,
  cornerRadiusPx,
  quoteInitial,
  quoteLayout,
  quoteLookOf,
  quotePortraitOf,
  quoteSlotsOf,
  type LayoutRect,
} from '@livedocuments/document';
import { GlyphDisc } from '@livedocuments/ui';
import { InlineTextLine } from '@liveworkspace/workbench/components/canvas/InlineTextLine';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';
import { useImageBlobUrl } from '@/hooks/persistence/useImageBlobUrl';

// The portrait's photo (docs/specs/009-elements/quote.md "The slots"), read through the same authenticated image path
// as an image element; while it loads, or if it cannot, the initial stands in.
function QuotePhoto({
  imageId,
  rect,
  image,
  initial,
}: {
  imageId: string;
  rect: LayoutRect;
  image: NonNullable<WebFaceProps['imageContext']>;
  initial: React.ReactNode;
}) {
  const state = useImageBlobUrl(image.ownerId, imageId, {
    documentId: image.documentId,
    shareCode: image.shareCode,
    maxEdge: Math.ceil(rect.width * 2),
  });
  if (state.status !== 'ready') return <>{initial}</>;
  return (
    <img
      src={state.src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute rounded-full object-cover"
      style={rectStyle(rect)}
    />
  );
}

// The quote (docs/specs/009-elements/quote.md): in the Card look its own rounded box, then the quote mark, the words
// (the element's label, in its region), the portrait and the source, all placed by quoteLayout, the numbers the export
// draws with. The name and role edit in place once the quote is selected.
export function QuoteFace({
  element,
  labelNode,
  accent,
  fill,
  textColor,
  fontFamily,
  editable,
  onSetHeading,
  imageContext,
}: WebFaceProps) {
  const zoom = useCanvasZoom();
  const l = quoteLayout(
    element.width,
    element.height,
    quoteSlotsOf(element, labelFontPx(element.textSize)),
  );
  const look = quoteLookOf(element);
  const portrait = quotePortraitOf(element);
  const initialDisc = l.portrait ? (
    <GlyphDisc
      as="div"
      size={l.portrait.width}
      aria-hidden
      className="pointer-events-none absolute font-bold"
      style={{
        ...rectStyle(l.portrait),
        backgroundColor: colorWash(accent, 0.16),
        color: accent,
        fontSize: l.portrait.width * 0.42,
        fontFamily,
      }}
    >
      {quoteInitial(element.pageTitle)}
    </GlyphDisc>
  ) : null;
  return (
    <>
      {look === 'card' ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 border"
          style={{
            backgroundColor: fill,
            borderColor: accent,
            borderRadius: cornerRadiusPx(
              element.borderRadius,
              element.width,
              element.height,
              BORDER_RADIUS_PX.lg,
            ),
          }}
        />
      ) : null}
      {l.mark ? (
        <div
          aria-hidden
          data-quote-mark=""
          className="pointer-events-none absolute select-none overflow-visible font-bold"
          style={{
            ...rectStyle(l.mark),
            color: accent,
            fontSize: l.markPx * 1.6,
            lineHeight: 1,
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          {QUOTE_MARK}
        </div>
      ) : null}
      <LabelRegion rect={l.body}>{labelNode}</LabelRegion>
      {l.portrait && portrait === 'photo' && element.imageId && imageContext ? (
        <QuotePhoto
          imageId={element.imageId}
          rect={l.portrait}
          image={imageContext}
          initial={initialDisc}
        />
      ) : (
        initialDisc
      )}
      {l.name && (element.pageTitle || editable) ? (
        <div className="absolute flex items-center" style={{ ...rectStyle(l.name), fontFamily }}>
          <InlineTextLine
            value={element.pageTitle ?? ''}
            placeholder="Name"
            editable={editable}
            onCommit={(v) => onSetHeading('pageTitle', v)}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate font-semibold leading-snug"
            style={{ color: textColor, fontSize: l.namePx }}
            ariaLabel="Quote name"
          />
        </div>
      ) : null}
      {l.role && (element.pageSubtitle || editable) ? (
        <div className="absolute flex items-center" style={{ ...rectStyle(l.role), fontFamily }}>
          <InlineTextLine
            value={element.pageSubtitle ?? ''}
            placeholder="Role"
            editable={editable}
            onCommit={(v) => onSetHeading('pageSubtitle', v)}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate leading-snug"
            style={{ color: textColor, fontSize: l.rolePx, opacity: 0.7 }}
            ariaLabel="Quote role"
          />
        </div>
      ) : null}
    </>
  );
}
