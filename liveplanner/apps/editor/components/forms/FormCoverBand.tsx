'use client';

// The band across a form's top (docs/specs/030-forms/forms.md "Cover"): its cover, a picture (placed by its focus)
// and/or a colour background painted by pageSheetStyle (and PageMotionLayer for a moving one), a pattern over either,
// or a thin band of the form colour without one. Pure drawing, shared by the builder, Preview and the form page.
import type { FormCover } from '@liveplanner/forms';
import { coverObjectPosition } from '@liveworkspace/page-background/cover';
import { pageSheetStyle } from '@/lib/page-paint';
import dynamic from 'next/dynamic';
import { useFormImage } from './form-images';

// A moving cover's motion, fetched only when a cover moves: every motion's drawing stays out of the form page's
// first load (most covers are still).
const PageMotionLayer = dynamic(
  () => import('@/components/canvas/PageMotionLayer').then((m) => m.PageMotionLayer),
  { ssr: false },
);

// The motion's drawing box: the form card's own width by the band's height (forms.css clips any overhang).
const BAND_W = 640;
const BAND_H = 160;

export function FormCoverBand({
  cover,
  accent,
  className = '',
}: {
  cover: FormCover | undefined;
  accent: string;
  className?: string;
}) {
  const src = useFormImage(cover?.imageId);
  if (!cover)
    return <div aria-hidden className={`h-2.5 ${className}`} style={{ background: accent }} />;
  const fill = cover.fill;
  const picture = !!cover.imageId;
  return (
    <div
      aria-hidden
      className={`relative h-40 overflow-hidden max-sm:h-24 ${fill || picture ? '' : 'bg-white text-slate-900/15 dark:bg-slate-900 dark:text-white/15'} ${picture ? 'bg-slate-200 text-white/25 dark:bg-slate-800' : ''} ${className}`}
      style={picture ? undefined : pageSheetStyle(cover)}
    >
      {fill?.kind === 'gradient' && fill.motion && !picture ? (
        <PageMotionLayer motion={fill.motion} fill={fill} width={BAND_W} height={BAND_H} />
      ) : null}
      {picture && src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: coverObjectPosition(cover.focus) }}
        />
      ) : null}
      {picture && cover.pattern ? (
        <div className="absolute inset-0" style={pageSheetStyle({ pattern: cover.pattern })} />
      ) : null}
      {picture && cover.credit ? (
        <span className="absolute bottom-1.5 left-2 max-w-[70%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90">
          {cover.credit}
        </span>
      ) : null}
    </div>
  );
}
