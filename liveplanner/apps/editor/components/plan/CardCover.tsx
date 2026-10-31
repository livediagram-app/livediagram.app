'use client';

// A card's cover and its Attachments chip on the card face (docs/specs/026-plan/items.md "Attachments", item-types.md
// "Card display"). The cover runs edge to edge across the top of a Detailed card, 120 px tall and cropped to fill,
// fetched only once the card nears the screen and at most IMAGE_COVER_EDGE on its longest side, never the original.
import type { ItemAttachment } from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideImage } from '@liveworkspace/icons/lucide';
import { IMAGE_COVER_EDGE } from '@/lib/api/images';
import { usePlan } from './PlanContext';
import { MetaPill } from './plan-card-parts';
import type { PlanPalette } from './plan-palette';
import { useImageUrl, useSeen } from './use-image-url';

const BrokenIcon = lucideGlyph(lucideImage, 18);
const PicturesIcon = lucideGlyph(lucideImage, 11);

// The cover's height, and how far it reaches past the card's padding to its edges (px-3 py-2.5).
const COVER =
  '-mx-3 -mt-2.5 mb-0.5 flex h-[120px] shrink-0 items-center justify-center overflow-hidden';

/** The cover across the top of a Detailed card. `sample` draws the type editor's placeholder instead. */
export function CardCover({
  cover,
  palette,
  sample = false,
}: {
  cover: ItemAttachment | null;
  palette: PlanPalette;
  sample?: boolean;
}) {
  const scope = usePlan()?.itemsScope;
  const [ref, seen] = useSeen<HTMLDivElement>();
  const shown = useImageUrl(sample ? null : scope, cover?.id ?? null, IMAGE_COVER_EDGE, seen);
  if (sample || !cover) {
    return (
      <div
        className={`${COVER} text-[11px] font-medium`}
        style={{
          color: palette.muted,
          backgroundColor: palette.column,
          backgroundImage: `repeating-linear-gradient(135deg, transparent 0 8px, ${palette.cardBorder} 8px 9px)`,
        }}
      >
        Cover image
      </div>
    );
  }
  return (
    <div
      ref={ref}
      data-card-cover=""
      role="img"
      aria-label={`Cover: ${cover.name}`}
      className={COVER}
      style={{ backgroundColor: palette.column, color: palette.muted }}
    >
      {shown.state === 'shown' ? (
        <img src={shown.url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : shown.state === 'missing' ? (
        <BrokenIcon />
      ) : (
        <span className="h-full w-full animate-pulse opacity-60 motion-reduce:animate-none" />
      )}
    </div>
  );
}

/** How many pictures a card holds: a picture glyph and the count, "Attachments: 3" to assistive technology. */
export function AttachmentsPill({ count, palette }: { count: number; palette: PlanPalette }) {
  return (
    <MetaPill palette={palette} label={`Attachments: ${count}`}>
      <span className="flex">
        <PicturesIcon />
      </span>
      <span aria-hidden>{count}</span>
    </MetaPill>
  );
}
