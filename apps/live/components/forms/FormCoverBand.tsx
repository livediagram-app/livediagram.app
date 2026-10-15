// The band across a form's top (docs/specs/030-forms/forms.md "The form card"): its cover, a slide background in
// colour painted as a slide's is (pageSheetStyle, and PageMotionLayer for a moving one), or a thin band of the form
// colour without one. Pure drawing, shared by the builder, Preview and the form page.
import type { FormCover } from '@livediagram/forms';
import { pageSheetStyle } from '@/lib/illustrate-page-paint';
import { PageMotionLayer } from '@/components/canvas/PageMotionLayer';

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
  if (!cover)
    return <div aria-hidden className={`h-2.5 ${className}`} style={{ background: accent }} />;
  const fill = cover.fill;
  return (
    <div
      aria-hidden
      className={`relative h-40 overflow-hidden max-sm:h-24 ${fill ? '' : 'bg-white text-slate-900/15 dark:bg-slate-900 dark:text-white/15'} ${className}`}
      style={pageSheetStyle(cover)}
    >
      {fill?.kind === 'gradient' && fill.motion ? (
        <PageMotionLayer motion={fill.motion} fill={fill} width={BAND_W} height={BAND_H} />
      ) : null}
    </div>
  );
}
