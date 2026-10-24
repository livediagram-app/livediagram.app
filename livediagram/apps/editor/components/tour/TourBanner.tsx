'use client';

// A tour's bookend cards as a banner (docs/specs/007-editor/editor-tour.md "The bookend cards ask nothing of the
// editor"): the offer ("Getting started with ...?") and the last card, laid out as the sign-in banner is, a wide row
// standing on the bottom chrome with the tour's picture, its words and its buttons side by side. It asks nothing of
// the editor: no backdrop, no focus taken, Escape only from inside it, so someone carrying on working leaves it there.
// The sign-in banner steps aside while it is up (TOUR_CARD_ATTR), so the two never show together.
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import type { StartPalette } from '@/components/start/start-palette';
import { lucideCircleHelp } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { announceToastFloorChange, BOTTOM_CHROME_SELECTOR } from '@/components/toast/toast-floor';
import { useChromeFloor } from '@/components/toast/useToastFloor';
import { tourColourVars } from './tour-colours';
import { TourHelpArt } from './TourHelpArt';
import type { TourCardCopy } from './tour-card-copy';
import { TourWelcomeArt } from './TourWelcomeArt';

// On the body while a bookend banner is up (SignInBanner steps aside).
export const TOUR_CARD_ATTR = 'data-tour-card-open';
// The banner's widest (max-w-3xl, as the sign-in banner's): the column it clears the bottom chrome in.
const BANNER_MAX_WIDTH_PX = 768;
// The last card's help link wears the help icon beside its label.
const HelpIcon = lucideGlyph(lucideCircleHelp, 16);

export function TourBanner({
  card,
  title,
  body,
  copy,
  welcomeArt,
  palette,
  onNext,
  onSkip,
}: {
  card: 'welcome' | 'outro';
  title: string;
  body: string;
  copy: TourCardCopy;
  welcomeArt?: ReactNode;
  palette: StartPalette;
  onNext: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const floor = useChromeFloor(true, 0, BOTTOM_CHROME_SELECTOR, BANNER_MAX_WIDTH_PX);

  // The toasts stand on it while it is up (docs/specs/004-interface-design/toasts.md "Placement"), and the sign-in
  // banner, which takes the same place, steps aside.
  useEffect(() => {
    document.body.setAttribute(TOUR_CARD_ATTR, '');
    announceToastFloorChange();
    return () => {
      document.body.removeAttribute(TOUR_CARD_ATTR);
      announceToastFloorChange();
    };
  }, []);

  // Escape declines the offer and finishes from the last card, as their buttons do, but only from inside the banner:
  // Escape anywhere else is the person's own. Never while a field is being edited, nor once something took it.
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (!ref.current?.contains(document.activeElement)) return;
    if (card === 'outro') onNext();
    else onSkip();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onEscape(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const welcome = card === 'welcome';
  return (
    // pointer-events-none on the wrapper so the gutters beside the banner never take a press meant for the canvas.
    <div
      className="pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex justify-center px-4"
      style={{ bottom: floor }}
    >
      <div
        ref={ref}
        data-tour-popover=""
        data-tour-banner={card}
        data-toast-floor=""
        role="dialog"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
        // No focus taken by a press either: a click on No or Yes leaves the focus where the person was working (a
        // Sheet's grid, a field), where it would otherwise fall to the page as the banner goes.
        onMouseDown={(e) => e.preventDefault()}
        // The sign-in banner's look in the tab's own hue: a deep gradient white reads on, in light and dark alike
        // (tour-colours bannerColours). Solid under the gradient (its end colour): forced colours drop gradients, and
        // the banner went see-through over the canvas (docs/specs/004-interface-design/forced-colors.md).
        style={{
          ...tourColourVars(palette),
          backgroundImage:
            'linear-gradient(135deg, var(--tour-banner-from), var(--tour-banner-to))',
        }}
        className="pointer-events-auto flex w-full max-w-3xl animate-fly-up-in flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[var(--tour-banner-to)] p-4 text-white shadow-2xl shadow-slate-900/30 sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pl-3 sm:pr-4 dark:shadow-black/40 [&_button]:relative [&_button]:touch-target-y"
      >
        {/* The tour's own picture, small: what it is about at a glance, as the sign-in banner's glyph tile is. On a
            ground of its own appearance: the art draws its dark frame in dark mode, which over white went a dull grey. */}
        <div
          aria-hidden
          className="hidden w-36 shrink-0 overflow-hidden rounded-xl bg-white/90 sm:block dark:bg-slate-900/80 [&_svg]:h-auto [&_svg]:w-full"
        >
          {welcome ? (welcomeArt ?? <TourWelcomeArt />) : <TourHelpArt />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90">
            {welcome ? copy.welcomeEyebrow : copy.outroEyebrow}
          </span>
          <p className="text-sm font-semibold sm:text-base">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/90 sm:text-sm">{body}</p>
        </div>
        {welcome ? (
          <div className="flex shrink-0 items-center justify-end gap-2">
            {/* Declining is a first-class, same-weight choice: the offer must never feel like a trap. It never
                comes back. */}
            <button
              type="button"
              onClick={onSkip}
              className="cursor-pointer rounded-lg border border-white/40 px-3 py-2 text-sm font-medium transition hover:bg-white/15"
            >
              {copy.decline}
            </button>
            <BannerButton onClick={onNext}>{copy.accept}</BannerButton>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-end gap-3 whitespace-nowrap">
            <a
              href={copy.helpHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition hover:text-white"
            >
              <HelpIcon aria-hidden />
              Learn More
            </a>
            <BannerButton onClick={onNext}>{copy.finish}</BannerButton>
          </div>
        )}
      </div>
    </div>
  );
}

// The banner's primary button, as the sign-in banner's: a white button with its label in the banner's own deep colour
// (5.9:1 or more on white, tour-colours bannerColours).
function BannerButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--tour-banner-from)] shadow-sm transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}
