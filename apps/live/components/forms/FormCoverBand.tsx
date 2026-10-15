// The band across a form's top (docs/specs/030-forms/forms.md "The form card"): one of the slide gradients, or the
// cover colour (the form colour when none is chosen) drawn plain, as a gradient into the form colour, or dotted. A
// thin accent line without a cover.
// Pure drawing, shared by the builder, Preview and the form page.
import type { FormCover } from '@livediagram/forms';

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
  const colour = cover.color ?? accent;
  const style: React.CSSProperties = cover.gradient
    ? { background: `linear-gradient(120deg, ${cover.gradient.from}, ${cover.gradient.to})` }
    : cover.style === 'gradient'
      ? {
          background: `linear-gradient(120deg, ${colour} 0%, color-mix(in srgb, ${accent} 70%, white) 100%)`,
        }
      : cover.style === 'dots'
        ? {
            backgroundColor: colour,
            backgroundImage:
              'radial-gradient(color-mix(in srgb, white 35%, transparent) 1.5px, transparent 1.6px)',
            backgroundSize: '18px 18px',
          }
        : { background: colour };
  return <div aria-hidden className={`h-40 max-sm:h-24 ${className}`} style={style} />;
}
