// The start header's title mark (each product's start spec, "The header band"): a small tile before the title holding
// the band's motif as one glyph, in the accent on the band's deeper shade. Decorative: the title names the panel.
import { memo, type ReactNode } from 'react';
import type { HeroBackdropKind } from '@liveworkspace/explorer/hero-theme';
import type { StartBandColours } from './start-band-colours';

function glyph(kind: HeroBackdropKind, ink: string): ReactNode {
  if (kind === 'blueprint')
    // A registration mark: the crosshair a drawing is lined up by.
    return (
      <g fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="5" />
        <path d="M10 1.5v5M10 13.5v5M1.5 10h5M13.5 10h5" />
      </g>
    );
  if (kind === 'lanes')
    // Three lanes, as full as a board midweek.
    return (
      <g fill={ink}>
        <rect x="2" y="3" width="4.5" height="14" rx="1.5" />
        <rect x="7.75" y="3" width="4.5" height="8.5" rx="1.5" opacity="0.6" />
        <rect x="13.5" y="3" width="4.5" height="11.5" rx="1.5" opacity="0.6" />
      </g>
    );
  if (kind === 'typesetter')
    // A pilcrow.
    return (
      <g fill={ink}>
        <path d="M9 3.5a3.75 3.75 0 0 0 0 7.5Z" />
        <rect x="9" y="3.5" width="6.5" height="1.8" />
        <rect x="9" y="3.5" width="1.8" height="13" />
        <rect x="12.6" y="3.5" width="1.8" height="13" />
      </g>
    );
  if (kind === 'shapes')
    // The shape kit: a circle, a triangle and a square.
    return (
      <g>
        <path d="M12.5 2.5L17.5 10.5H7.5Z" fill={ink} opacity="0.6" />
        <circle cx="6.5" cy="13.5" r="4" fill={ink} />
        <rect
          x="11"
          y="12"
          width="6"
          height="6"
          rx="1"
          fill="none"
          stroke={ink}
          strokeWidth="1.6"
        />
      </g>
    );
  if (kind === 'huddle')
    // A table seen from above, four seats round it, the one speaking full.
    return (
      <g fill={ink}>
        <circle cx="10" cy="10" r="3.2" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.6" />
        <circle cx="10" cy="3" r="2.3" />
        <circle cx="17" cy="10" r="2.3" opacity="0.6" />
        <circle cx="10" cy="17" r="2.3" opacity="0.6" />
        <circle cx="3" cy="10" r="2.3" opacity="0.6" />
      </g>
    );
  // Dots: nine of them.
  return (
    <g fill={ink}>
      {[4, 10, 16].flatMap((y) =>
        [4, 10, 16].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />),
      )}
    </g>
  );
}

// The Automations screen's mark (StartHeaderBand's `variant`): a bolt, what sets a rule off.
function bolt(ink: string): ReactNode {
  return <path d="M11.5 1.75L4.5 11.25h5L8.25 18.25l7.25-9.75h-5Z" fill={ink} />;
}

export const StartTitleMark = memo(function StartTitleMark({
  kind,
  band,
  variant,
}: {
  kind: HeroBackdropKind;
  band: StartBandColours;
  variant?: 'automations' | undefined;
}) {
  return (
    <span
      aria-hidden
      data-start-title-mark={variant ?? kind}
      className="flex size-9 shrink-0 items-center justify-center rounded-[11px] max-sm:size-8"
      style={{ backgroundColor: band.wash, boxShadow: `inset 0 0 0 1px ${band.line}` }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        {variant ? bolt(band.accent) : glyph(kind, band.accent)}
      </svg>
    </span>
  );
});
