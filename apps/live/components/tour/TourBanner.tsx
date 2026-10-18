'use client';

// A tour's bookend cards as a banner (docs/specs/007-editor/editor-tour.md "The bookend cards ask nothing of the
// editor"): the offer ("Getting started with ...?") and the last card, laid out as the sign-in banner is, a wide row
// standing on the bottom chrome with the tour's picture, its words and its buttons side by side. It asks nothing of
// the editor: no backdrop, no focus taken, Escape only from inside it, so someone carrying on working leaves it there.
// The sign-in banner steps aside while it is up (TOUR_CARD_ATTR), so the two never show together.
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import type { PlanPalette } from '@livediagram/document';
import { announceToastFloorChange, BOTTOM_CHROME_SELECTOR } from '@/components/toast/toast-floor';
import { useChromeFloor } from '@/components/toast/useToastFloor';
import { tourColourVars } from './tour-colours';
import { TourHelpArt } from './TourHelpArt';
import type { TourCardCopy, TourWelcomeChoice } from './tour-card-copy';
import { TourWelcomeArt } from './TourWelcomeArt';

// On the body while a bookend banner is up (SignInBanner steps aside).
export const TOUR_CARD_ATTR = 'data-tour-card-open';
// The banner's widest (max-w-3xl, as the sign-in banner's): the column it clears the bottom chrome in.
const BANNER_MAX_WIDTH_PX = 768;

export function TourBanner({
  card,
  title,
  body,
  copy,
  welcomeArt,
  welcomeChoices,
  palette,
  onNext,
  onSkip,
}: {
  card: 'welcome' | 'outro';
  title: string;
  body: string;
  copy: TourCardCopy;
  welcomeArt?: ReactNode;
  welcomeChoices?: readonly TourWelcomeChoice[];
  palette: PlanPalette;
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
        style={tourColourVars(palette)}
        className="pointer-events-auto flex w-full max-w-3xl animate-fly-up-in flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--tour-border)] bg-[var(--tour-card)] p-4 text-[var(--tour-text)] shadow-2xl shadow-slate-900/20 sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pl-3 sm:pr-4 dark:shadow-black/40 [&_button]:relative [&_button]:touch-target-y"
      >
        {/* The tour's own picture, small: what it is about at a glance, as the sign-in banner's glyph tile is. */}
        <div aria-hidden className="hidden w-36 shrink-0 sm:block [&_svg]:h-auto [&_svg]:w-full">
          {welcome ? (welcomeArt ?? <TourWelcomeArt />) : <TourHelpArt />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tour-accent)]">
            {welcome ? copy.welcomeEyebrow : copy.outroEyebrow}
          </span>
          <p className="text-sm font-semibold sm:text-base">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--tour-muted)] sm:text-sm">
            {body}
          </p>
        </div>
        {welcome ? (
          <div className="flex shrink-0 items-center justify-end gap-2">
            {/* Declining is a first-class, same-weight choice: the offer must never feel like a trap. It never
                comes back. */}
            <button
              type="button"
              onClick={onSkip}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-[var(--tour-muted)] transition hover:bg-[var(--tour-hover)] hover:text-[var(--tour-text)]"
            >
              {copy.decline}
            </button>
            {welcomeChoices ? (
              welcomeChoices.map((choice) => (
                <BannerButton key={choice.id} onClick={choice.onPick}>
                  {choice.label}
                </BannerButton>
              ))
            ) : (
              <BannerButton onClick={onNext}>{copy.accept}</BannerButton>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-end gap-3 whitespace-nowrap">
            <a
              href={copy.helpHref}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[var(--tour-accent)] underline-offset-2 transition hover:underline"
            >
              {copy.helpLabel}
            </a>
            <BannerButton onClick={onNext}>{copy.finish}</BannerButton>
          </div>
        )}
      </div>
    </div>
  );
}

// The banner's primary button in the tab's accent, its label in the ink that reads on it (tour-colours inkOn).
function BannerButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[var(--tour-accent)] px-4 py-2 text-sm font-semibold text-[var(--tour-on-accent)] shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
    >
      {children}
    </button>
  );
}
