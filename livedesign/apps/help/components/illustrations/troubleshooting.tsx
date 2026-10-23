// Troubleshooting-category illustrations (docs/specs/018-help/help-app.md): the concrete states a stuck
// editor shows (a loading canvas, a sign-in error, a rendering glitch, a save
// that could not reach the server). Composed
// only from the shared primitives so the house style holds.

import { useId } from 'react';
import { Scene, Shape, Panel, Button, Label } from './primitives';

/** A design stuck mid-load, as DesignLoading draws it: the diagram building itself, the title
 *  and detail line over the loading sweep, and, after 10 seconds, the "taking longer" line with
 *  a small secondary Refresh. */
export function StuckCanvas() {
  return (
    <Scene w={420} h={220}>
      {/* The build animation: a little diagram drawing itself in. */}
      <rect
        x={170}
        y={28}
        width={30}
        height={20}
        rx={4}
        className="fill-white stroke-brand-300"
        strokeWidth={1.6}
      />
      <path d="M200 38 H216" className="stroke-brand-300" strokeWidth={1.6} />
      <rect
        x={220}
        y={28}
        width={30}
        height={20}
        rx={4}
        className="fill-brand-100 stroke-brand-400"
        strokeWidth={1.6}
        strokeDasharray="4 3"
      />
      <Label x={210} y={78} anchor="middle" size={12} weight={600} tone="strong">
        Opening your design
      </Label>
      <Label x={210} y={96} anchor="middle" size={10} tone="muted">
        Getting everything in place
      </Label>
      {/* The loading sweep. */}
      <rect x={150} y={108} width={120} height={4} rx={2} className="fill-slate-200" />
      <rect x={176} y={108} width={44} height={4} rx={2} className="fill-brand-400" />
      <Label x={210} y={146} anchor="middle" size={10} tone="muted">
        This is taking longer than usual.
      </Label>
      <Button x={178} y={158} w={64} h={24} label="Refresh" />
    </Scene>
  );
}

/** The sign-in code step in an error state: the error above the form, the
 *  six code boxes, Verify, and the Resend code / Back row. */
export function SignInError() {
  const digits = ['1', '2', '4', '9', '0', '7'];
  return (
    <Scene w={420} h={250} bg="plain">
      <Panel x={98} y={10} w={224} h={230}>
        <Label x={210} y={32} anchor="middle" size={14} weight={700} tone="strong">
          livedesign
        </Label>
        {/* The error, above the form */}
        <rect
          x={114}
          y={46}
          width={192}
          height={24}
          rx={6}
          className="fill-rose-50 stroke-rose-300"
          strokeWidth={1.5}
        />
        <Label
          x={210}
          y={59}
          anchor="middle"
          size={10}
          weight={600}
          className="fill-rose-600 dark:fill-rose-300"
        >
          Incorrect code
        </Label>
        <Label x={210} y={86} anchor="middle" size={10} tone="muted">
          We sent a verification code to
        </Label>
        <Label x={210} y={100} anchor="middle" size={10} weight={600} tone="body">
          you@example.com. Enter it below.
        </Label>
        {digits.map((d, i) => (
          <g key={i}>
            <rect
              x={120 + i * 31}
              y={112}
              width={25}
              height={30}
              rx={6}
              className="fill-white stroke-slate-300"
              strokeWidth={1.5}
            />
            <Label x={132.5 + i * 31} y={128} anchor="middle" size={12} weight={600} tone="strong">
              {d}
            </Label>
          </g>
        ))}
        <Button x={114} y={156} w={192} h={28} label="Verify" variant="primary" />
        <Label x={160} y={210} anchor="middle" size={10} weight={600} tone="muted">
          Resend code
        </Label>
        <Label x={262} y={210} anchor="middle" size={10} weight={600} tone="muted">
          Back
        </Label>
      </Panel>
    </Scene>
  );
}

/** Supported browsers as labelled tiles: Chrome, Edge, Firefox, Safari, each a
 *  rounded card with a ringed glyph. */
export function BrowserTiles() {
  const browsers: { name: string; ring: string }[] = [
    { name: 'Chrome', ring: 'stroke-brand-500' },
    { name: 'Edge', ring: 'stroke-teal-500' },
    { name: 'Firefox', ring: 'stroke-amber-500' },
    { name: 'Safari', ring: 'stroke-indigo-500' },
  ];
  return (
    <Scene w={420} h={170} bg="plain">
      {browsers.map(({ name, ring }, i) => {
        const tx = 30 + i * 98;
        return (
          <g key={name}>
            <rect
              x={tx}
              y={36}
              width={84}
              height={84}
              rx={12}
              className="fill-white stroke-slate-200"
              strokeWidth={2}
            />
            <circle cx={tx + 42} cy={70} r={18} className={`fill-none ${ring}`} strokeWidth={4} />
            <circle cx={tx + 42} cy={70} r={6} className="fill-slate-200" />
            <Label x={tx + 42} y={106} anchor="middle" size={10} weight={600} tone="body">
              {name}
            </Label>
            {/* Up-to-date check badge */}
            <g transform={`translate(${tx + 64} ${44})`}>
              <circle r={9} className="fill-emerald-500 stroke-white" strokeWidth={2} />
              <path
                d="M-4 0 L-1 3 L4 -3"
                className="fill-none stroke-white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}

/** A rendering glitch versus the fixed result: a misaligned, clipped shape next
 *  to the same shape rendering cleanly after an update or hard refresh. */
export function RenderGlitch() {
  const head = `rg-head-${useId().replace(/:/g, '')}`;
  return (
    <Scene w={420} h={200}>
      {/* Before: a glitched, clipped, misaligned render */}
      <Label x={106} y={36} anchor="middle" size={10} weight={700} tone="muted">
        STALE
      </Label>
      <g>
        <rect
          x={56}
          y={56}
          width={100}
          height={60}
          rx={7}
          className="fill-white stroke-rose-300"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        {/* Misaligned inner block + broken text bars */}
        <rect x={70} y={48} width={44} height={26} rx={4} className="fill-slate-200" />
        <rect x={92} y={92} width={70} height={8} className="fill-slate-300" />
        <rect x={48} y={104} width={40} height={8} className="fill-slate-300" />
      </g>
      {/* Arrow between */}
      <path
        d="M176 86 H236"
        className="fill-none stroke-slate-400"
        strokeWidth={2.5}
        strokeLinecap="round"
        markerEnd={`url(#${head})`}
      />
      <defs>
        <marker id={head} markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className="fill-slate-400" />
        </marker>
      </defs>
      <Label x={210} y={70} anchor="middle" size={10} weight={600} tone="muted">
        refresh
      </Label>
      {/* After: a clean render */}
      <Label x={314} y={36} anchor="middle" size={10} weight={700} tone="accent">
        FIXED
      </Label>
      <Shape x={264} y={56} w={100} h={60} kind="rect" accent label="Idea" />
    </Scene>
  );
}

/** A save that did not reach the server: the canvas carries on, and the
 *  bottom-centre toast says so. Autosave keeps retrying. */
export function SaveFailedToast() {
  return (
    <Scene w={420} h={200}>
      <Shape x={60} y={34} w={96} h={48} kind="rect" label="Plan" />
      <Shape x={250} y={34} w={96} h={48} kind="rect" accent label="Build" />
      <rect
        x={30}
        y={138}
        width={360}
        height={34}
        rx={9}
        className="fill-rose-50 stroke-rose-300"
        strokeWidth={1.5}
      />
      <g transform="translate(50 155)">
        <circle r={8} className="fill-rose-500" />
        <path
          d="M0 -4 V1 M0 4 V4.5"
          className="stroke-white"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
      <Label x={66} y={156} size={11} weight={600} className="fill-rose-700 dark:fill-rose-300">
        Couldn&rsquo;t save your changes. Check your connection.
      </Label>
    </Scene>
  );
}
