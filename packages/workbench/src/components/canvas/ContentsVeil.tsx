'use client';

// A set-aside page's veil over its Contents picture (docs/specs/007-editor/pages-mode.md "Contents"):
// a soft frosted wash with faint diagonal lines and a small pill in the middle reading Hidden with a
// crossed eye, the eye alone where the picture is too narrow for the word. It stays mounted while
// off, so hiding and showing ease it in and out; its blur is set only while on, so a list of pages
// in use pays for none.
import { lucideEyeOff } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

const EyeOffSmall = lucideGlyph(lucideEyeOff, 10);
const EyeOffLarge = lucideGlyph(lucideEyeOff, 12);

/** Pictures narrower than this (screen px) show the pill's eye without its word. */
const VEIL_WORD_MIN_W = 56;

// Faint diagonal lines, slate at a low alpha so they read on a light and a dark picture alike.
const HATCH =
  'repeating-linear-gradient(135deg, rgb(100 116 139 / 0.18) 0 1px, transparent 1px 6px)';

/** The picture's look under a veil: greyed and faded, lifted a little while the row is hovered. */
export function veiledPictureClass(on: boolean): string {
  return `transition-[opacity,filter] duration-150 motion-reduce:transition-none ${
    on ? 'opacity-40 grayscale group-hover:opacity-60' : ''
  }`;
}

export function ContentsVeil({
  on,
  width,
  large,
}: {
  on: boolean;
  width: number;
  large?: boolean;
}) {
  const word = width >= VEIL_WORD_MIN_W;
  return (
    <span
      aria-hidden
      data-contents-veil={on ? '' : undefined}
      className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-white/35 transition-opacity duration-150 motion-reduce:transition-none dark:bg-slate-950/40 ${
        on ? 'opacity-100 backdrop-blur-[1.5px] group-hover:opacity-75' : 'opacity-0'
      }`}
      style={{ backgroundImage: HATCH }}
    >
      <span
        className={`flex items-center gap-1 rounded-full bg-slate-900/80 font-semibold leading-none tracking-wide text-white shadow-sm ring-1 ring-white/10 transition-transform duration-200 motion-reduce:transition-none dark:bg-white/90 dark:text-slate-900 dark:ring-slate-900/10 ${
          word ? (large ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-[3px] text-[10px]') : 'p-1'
        } ${on ? 'scale-100' : 'scale-90'}`}
      >
        {large ? <EyeOffLarge /> : <EyeOffSmall />}
        {word ? 'Hidden' : null}
      </span>
    </span>
  );
}
