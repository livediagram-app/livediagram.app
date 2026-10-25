// Share dialog and share-gate scenes for the Collaboration › Sharing articles
// (docs/specs/018-help/help-app.md). Labels are the real UI strings.

import { Button, Label, Scene } from '@liveworkspace/help-site/art/primitives';

// --- Shared pieces -----------------------------------------------------------

/** A small lock glyph. */
function Lock({
  x,
  y,
  className = 'stroke-slate-400',
}: {
  x: number;
  y: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className={`fill-none ${className}`} strokeWidth={1.3}>
      <rect x={0} y={4.5} width={9} height={6.5} rx={1.5} />
      <path d="M2 4.5 V3 a2.5 2.5 0 0 1 5 0 V4.5" />
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** What a visitor on a protected share link sees: the full-screen password card. */
export function SharePasswordGate() {
  return (
    <Scene w={420} h={226} bg="plain">
      <rect
        x={70}
        y={10}
        width={280}
        height={206}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <circle cx={210} cy={42} r={18} className="fill-brand-100" />
      <Lock x={203} y={33} className="stroke-brand-600" />
      <Label x={210} y={78} anchor="middle" size={13} weight={700} tone="strong">
        This plan is password-protected
      </Label>
      <Label x={210} y={98} anchor="middle" size={10} tone="body">
        Enter the password Aria set to open this plan.
      </Label>
      <rect
        x={94}
        y={114}
        width={232}
        height={30}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={106} y={130} size={12} tone="strong">
        ••••••••
      </Label>
      <Label x={210} y={158} anchor="middle" size={10} weight={500} className="fill-rose-500">
        That password didn&apos;t match. Try again.
      </Label>
      <Button x={94} y={174} w={232} h={30} label="Open plan" variant="primary" />
    </Scene>
  );
}
