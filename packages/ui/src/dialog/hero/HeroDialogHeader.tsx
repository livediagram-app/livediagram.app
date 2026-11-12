// The dialog hero header (liveworkspace/docs/specs/004-index/dialog-hero-header.md): the start screens' header band
// brought to a dialog. A band in the host's brand ramp behind a 36px title mark, the title (a real <h2>, in the app's
// heading face) and one muted line, then the dialog's actions and its close. Exactly 100px tall from `sm`; compact on
// a phone (a 32px mark, an 18px title wrapping to two lines at most, the line left to screen readers). The band is
// the art's (HeroArt): a texture, corner pieces, and from a 56rem header a centre piece. It is static: memoised on
// the art, which is a module constant, so it paints once however often the dialog re-renders.
import { memo, type CSSProperties, type ReactNode } from 'react';
import { SHEET_HANDLE_PX } from '../../SheetHandle';
import { DialogCloseButton } from '../DialogCloseButton';
import { heroCentreCap, type HeroArt } from './hero-art';
import { HERO_TOKEN_STYLE } from './hero-tokens';

// The heading face without prop plumbing: an app whose heading face differs (livedocuments' Typesetter serif) sets
// these three custom properties in its globals; every other app leaves them unset. An unset `--hero-heading-family`
// leaves font-family invalid at computed time, which an inherited property treats as `inherit`: the page's own face.
// The defaults are the start header's heavy face (startHeadingFace).
const TITLE_FACE =
  '[font-family:var(--hero-heading-family)] [font-weight:var(--hero-heading-weight,800)] [letter-spacing:var(--hero-heading-tracking,-0.025em)]';

// The panel's corner radius, so the band's top corners follow the panel's (a card's, a phone sheet's, none edge to
// edge). The header is the panel's first child, or the sheet's handle comes first and the band runs up under it.
// The tokens, and how far a phone sheet's handle stands over the header: one object, built once.
const HEADER_STYLE = {
  ...HERO_TOKEN_STYLE,
  '--hero-lift': `${SHEET_HANDLE_PX}px`,
} as CSSProperties;

const TOP_RADIUS = '[border-top-left-radius:inherit] [border-top-right-radius:inherit]';

/** The band: the art's texture and pieces over the paper, a hairline at its foot. Hidden, inert, painted once. */
export const HeroBand = memo(function HeroBand({
  art,
  underHandle = false,
}: {
  art: HeroArt;
  underHandle?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-dialog-hero-art={art.name}
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[var(--hero-paper)] shadow-[inset_0_-1px_0_var(--hero-faint)] ${TOP_RADIUS} ${
        underHandle ? 'max-sm:top-[calc(var(--hero-lift)*-1)]' : ''
      }`}
      style={art.texture}
    >
      {art.pieces}
    </div>
  );
});

/** The title mark: a 36px tile (32px on a phone) in the wash, holding the art's 20 x 20 glyph in the accent. */
export const HeroTitleMark = memo(function HeroTitleMark({ art }: { art: HeroArt }) {
  return (
    <span
      aria-hidden
      data-dialog-hero-mark={art.name}
      className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--hero-wash)] shadow-[inset_0_0_0_1px_var(--hero-line)] max-sm:size-8"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" focusable="false">
        {art.glyph}
      </svg>
    </span>
  );
});

export type HeroDialogHeaderProps = {
  art: HeroArt;
  /** The <h2>'s id, for the dialog's `titleId` (aria-labelledby). */
  titleId: string;
  title: ReactNode;
  /** One line under the title, truncated, never wrapping the band taller; on a phone, for screen readers only. */
  subtitle?: ReactNode;
  /** The dialog's own controls, before the close. */
  actions?: ReactNode;
  /** The close (DialogCloseButton), last. Absent, no close. */
  onClose?: () => void;
  /** A phone sheet's header: the band runs up under its grab handle. */
  underHandle?: boolean;
  /** Extra classes, e.g. `[--hero-centre-end:15rem]` for wider actions. */
  className?: string;
};

export function HeroDialogHeader({
  art,
  titleId,
  title,
  subtitle,
  actions,
  onClose,
  underHandle = false,
  className = '',
}: HeroDialogHeaderProps) {
  // Where a centre piece shows, the title and its line stop short of it, so the two never meet.
  const cap = heroCentreCap(art);
  return (
    <header
      data-dialog-hero={art.name}
      // `color-scheme` from the app's `.dark` class (and a `.light` island), so the tokens' light-dark() pairs follow
      // the same switch every `dark:` class does.
      className={`@container relative isolate flex shrink-0 items-center gap-3 [color-scheme:light] dark:[color-scheme:dark] sm:h-[100px] sm:px-6 max-sm:px-4 max-sm:py-3 ${TOP_RADIUS} ${className}`}
      style={HEADER_STYLE}
    >
      <HeroBand art={art} underHandle={underHandle} />
      <HeroTitleMark art={art} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2
          id={titleId}
          className={`text-[20px] leading-tight sm:truncate max-sm:line-clamp-2 text-[var(--hero-ink)] max-sm:text-[18px] ${TITLE_FACE} ${cap}`}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            data-dialog-hero-subtitle=""
            className={`truncate text-[13px] leading-[18px] text-[var(--hero-muted)] max-sm:sr-only ${cap}`}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions || onClose ? (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onClose ? <DialogCloseButton onClick={onClose} /> : null}
        </div>
      ) : null}
    </header>
  );
}
