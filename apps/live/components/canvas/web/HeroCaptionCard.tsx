import {
  ACCENT_BAR_TEXT,
  heroCaptionLayout,
  PAGE_HEADING_MAX,
  type HeroCaption,
  type ImageElement,
} from '@livediagram/diagram';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { rectStyle } from '@/components/canvas/web/web-face-props';

// A hero's caption card (spec/146): inset near the bottom of the image in the
// image's fill (the theme accent when dropped from the palette), with a title
// and a supporting line edited in place. Inset rather than full-cover, so the
// image above stays double-clickable to set or change it.
export function HeroCaptionCard({
  element,
  caption,
  editable,
  zoom,
  fontFamily,
  onSetLine,
}: {
  element: ImageElement;
  caption: HeroCaption;
  editable: boolean;
  zoom: number;
  fontFamily: string | undefined;
  onSetLine?: (field: keyof HeroCaption, value: string) => void;
}) {
  const l = heroCaptionLayout(element.width, element.height);
  const color = element.textColor ?? ACCENT_BAR_TEXT;
  const canEdit = editable && !!onSetLine;
  return (
    <>
      <div
        className="pointer-events-none absolute rounded-xl"
        style={{
          ...rectStyle(l.card),
          backgroundColor: element.fillColor ?? '#0f172a',
          opacity: 0.82,
        }}
      />
      <div className="absolute" style={{ ...rectStyle(l.title), fontFamily }}>
        <InlineTextLine
          value={caption.title}
          placeholder="Title"
          editable={canEdit}
          onCommit={(v) => onSetLine?.('title', v)}
          zoom={zoom}
          maxLength={PAGE_HEADING_MAX}
          className="text-center font-bold leading-tight"
          style={{ color, fontSize: l.titlePx }}
          ariaLabel="Hero title"
        />
      </div>
      <div className="absolute" style={{ ...rectStyle(l.subtitle), fontFamily }}>
        <InlineTextLine
          value={caption.subtitle}
          placeholder="Supporting line"
          editable={canEdit}
          onCommit={(v) => onSetLine?.('subtitle', v)}
          zoom={zoom}
          maxLength={PAGE_HEADING_MAX}
          className="text-center leading-snug"
          style={{ color, opacity: 0.92, fontSize: l.subtitlePx }}
          ariaLabel="Hero supporting line"
        />
      </div>
    </>
  );
}
