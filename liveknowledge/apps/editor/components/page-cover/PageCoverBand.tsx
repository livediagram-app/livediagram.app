'use client';

// The open page's cover (docs/specs/030-knowledgebase/page-surface.md "The cover"; blueprint:
// docs/specs/030-knowledgebase/blueprints/page-surface.md "The cover"): a band across the top of the page area, in
// the page's scroll container over its top room, between the page tree and the rail (usePageSurface writes its
// edges and height on the container, so the band never measures anything and never re-renders for a scroll). Its
// height is the container's variable from the first paint, so nothing under it moves when the picture lands. A
// gradient or animated cover is painted in the knowledgebase's theme as it is drawn, so a change of style recolours
// it (CoverMotion: the moving one).
import { useRef, useState, type CSSProperties } from 'react';
import {
  coverFill,
  coverKindOf,
  coverObjectPosition,
  type TabCover,
} from '@liveknowledge/document';
import { fillCss } from '@/lib/page-paint';
import {
  PAGE_COVER_HEIGHT_VAR,
  PAGE_COVER_LEFT_VAR,
  PAGE_COVER_RIGHT_VAR,
} from '@/lib/page-surface/page-lock';
import { useImageSources } from '@/components/canvas/page-image-access';
import { usePageCover, useCoverEditable, useCoverTheme } from './page-cover-state';
import { CoverMotion } from './CoverMotion';
import { CoverControls } from './CoverControls';
import { useCoverReposition } from './useCoverReposition';

const BAND_STYLE: CSSProperties = {
  left: `var(${PAGE_COVER_LEFT_VAR}, 0px)`,
  right: `var(${PAGE_COVER_RIGHT_VAR}, 0px)`,
  height: `var(${PAGE_COVER_HEIGHT_VAR}, 0px)`,
};

const NO_IDS: readonly string[] = [];

export function PageCoverBand() {
  const cover = usePageCover();
  const editable = useCoverEditable();
  if (!cover) return null;
  return <PageCoverBandView cover={cover} editable={editable} />;
}

const KIND_ATTR = { image: 'picture', gradient: 'gradient', animated: 'animated' } as const;

export function PageCoverBandView({ cover, editable }: { cover: TabCover; editable: boolean }) {
  const imageId = 'imageId' in cover ? cover.imageId : undefined;
  const kind = coverKindOf(cover);
  const { theme } = useCoverTheme();
  const fill = coverFill(cover, theme);
  const inline = imageId?.startsWith('data:') ? imageId : undefined;
  const sourceOf = useImageSources(imageId && !inline ? [imageId] : NO_IDS);
  const src = inline ?? (imageId ? sourceOf(imageId) : undefined);
  const imgRef = useRef<HTMLImageElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const reposition = useCoverReposition({ cover, imgRef, bandRef });
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = !!src && loadedSrc === src;
  const focus = reposition.active ? reposition.focus : 'focus' in cover ? cover.focus : undefined;
  const gradient = fill ? fillCss(fill) : undefined;
  const credit = 'credit' in cover ? cover.credit : undefined;
  return (
    <div
      ref={bandRef}
      data-page-cover={KIND_ATTR[kind]}
      data-repositioning={reposition.active ? '' : undefined}
      {...(reposition.active ? reposition.bandProps : {})}
      // A picture's band holds a soft tint of the accent until the picture lands (page-surface.md "While loading").
      className={`group/cover absolute top-0 z-[1] select-none overflow-hidden outline-none ${
        imageId ? 'bg-brand-50 dark:bg-brand-500/15' : ''
      } ${reposition.active ? 'cursor-grab touch-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600' : ''}`}
      style={gradient ? { ...BAND_STYLE, background: gradient } : BAND_STYLE}
    >
      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          // The band is the first thing on the page: fetched at once, never lazily.
          fetchPriority="high"
          onLoad={() => setLoadedSrc(src)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ease-out motion-reduce:transition-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectPosition: coverObjectPosition(focus) }}
        />
      ) : null}
      {fill?.kind === 'gradient' && fill.motion ? (
        <CoverMotion motion={fill.motion} fill={fill} bandRef={bandRef} />
      ) : null}
      {imageId && credit && !reposition.active ? (
        <span
          data-cover-credit=""
          className="absolute bottom-2 left-3 max-w-[60%] truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] leading-4 text-white/90 phone:bottom-1.5 phone:left-2"
        >
          {credit}
        </span>
      ) : null}
      {editable ? <CoverControls cover={cover} reposition={reposition} /> : null}
    </div>
  );
}
