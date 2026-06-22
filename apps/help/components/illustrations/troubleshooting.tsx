// Troubleshooting-category illustrations (spec/55): the concrete states a stuck
// editor shows (a loading canvas, a sign-in error, a dropped live connection, a
// rendering glitch, the autosave indicator and the Activity Panel). Composed
// only from the shared primitives so the house style holds.

import { useId } from 'react';
import { Scene, Shape, Panel, Button, Label, TextBar, Avatar } from './primitives';

/** A blank canvas stuck mid-load: a brand spinner ring over the dot grid with a
 *  reload button, the surface you see when a diagram will not open. */
export function StuckCanvas() {
  return (
    <Scene w={420} h={220}>
      {/* Spinner: a faint full ring plus a brand arc */}
      <circle cx={210} cy={84} r={20} className="fill-none stroke-slate-200" strokeWidth={5} />
      <path
        d="M210 64 a20 20 0 0 1 20 20"
        className="fill-none stroke-brand-500"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Label x={210} y={126} anchor="middle" size={12} weight={600} tone="muted">
        Loading diagram…
      </Label>
      <Button x={172} y={148} w={76} label="Reload" variant="primary" />
    </Scene>
  );
}

/** The sign-in card in an error state: a wrong email code, an inline error, and
 *  a resend-code affordance. */
export function SignInError() {
  return (
    <Scene w={420} h={240} bg="plain">
      <Panel x={108} y={26} w={204} h={188}>
        <Label x={210} y={50} anchor="middle" size={13} weight={700} tone="strong">
          Sign in
        </Label>
        <Label x={124} y={76} size={10} weight={600} tone="muted">
          EMAIL CODE
        </Label>
        {/* Code field in an error (rose) state */}
        <rect
          x={124}
          y={84}
          width={172}
          height={30}
          rx={7}
          className="fill-white stroke-rose-400"
          strokeWidth={2}
        />
        <Label x={136} y={100} size={13} weight={600} tone="strong">
          1 2 4 _ _ _
        </Label>
        <Label x={124} y={128} size={10} weight={500} className="fill-rose-500">
          That code is not right. Try again.
        </Label>
        <Button x={124} y={144} w={172} label="Continue" variant="primary" />
        <Label x={210} y={188} anchor="middle" size={10} weight={600} tone="accent">
          Resend code
        </Label>
      </Panel>
    </Scene>
  );
}

/** A dropped live connection: a presence row where collaborators show as
 *  reconnecting, with an amber connection indicator. */
export function ConnectionState() {
  return (
    <Scene w={420} h={200}>
      <Panel x={70} y={40} w={280} h={120} title="LIVE">
        {/* Connection indicator: amber dot + reconnecting label */}
        <circle cx={88} cy={78} r={6} className="fill-amber-400" />
        <Label x={102} y={79} size={10} weight={600} tone="strong">
          Reconnecting…
        </Label>
        {/* Faded collaborator avatars (presence not syncing) */}
        <g opacity={0.45}>
          <Avatar cx={290} cy={78} r={12} initial="A" colour="emerald" />
          <Avatar cx={314} cy={78} r={12} initial="B" colour="violet" />
        </g>
        <line x1={86} y1={104} x2={334} y2={104} className="stroke-slate-200" strokeWidth={1.5} />
        <TextBar x={86} y={120} w={210} />
        <TextBar x={86} y={134} w={150} tone="faint" />
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
      <Shape x={264} y={56} w={100} h={60} kind="rect" accent label="Server" />
    </Scene>
  );
}

/** The autosave indicator in its settled state: a check with an "All changes
 *  saved" label, the reassurance that work reached the server. */
export function SavedState() {
  return (
    <Scene w={420} h={140}>
      <Panel x={108} y={48} w={204} h={44}>
        <g transform="translate(132 70)">
          <circle r={11} className="fill-emerald-500" />
          <path
            d="M-5 0 L-1 4 L5 -4"
            className="fill-none stroke-white"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <Label x={154} y={71} size={12} weight={600} tone="strong">
          All changes saved
        </Label>
      </Panel>
    </Scene>
  );
}

/** The Activity Panel: a list of recent edits, newest first, with a Revert
 *  action on the selected entry, the recovery tool for a lost change. */
export function ActivityHistory() {
  const rows: { who: string; what: string; colour: 'emerald' | 'violet' | 'brand' }[] = [
    { who: 'You', what: 'Moved "Server"', colour: 'brand' },
    { who: 'Ada', what: 'Deleted "Cache"', colour: 'emerald' },
    { who: 'You', what: 'Edited label', colour: 'brand' },
    { who: 'Sam', what: 'Added arrow', colour: 'violet' },
  ];
  return (
    <Scene w={420} h={240}>
      <Panel x={92} y={20} w={236} h={200} title="ACTIVITY">
        {rows.map((row, i) => {
          const ry = 58 + i * 38;
          const selected = i === 1;
          return (
            <g key={i}>
              {selected && (
                <rect x={100} y={ry - 4} width={220} height={34} rx={6} className="fill-brand-50" />
              )}
              <Avatar cx={116} cy={ry + 13} r={9} initial={row.who[0]} colour={row.colour} />
              <Label x={134} y={ry + 8} size={11} weight={600} tone="strong">
                {row.what}
              </Label>
              <Label x={134} y={ry + 21} size={9} weight={500} tone="muted">
                {row.who}
              </Label>
              {selected && (
                <g>
                  <rect
                    x={262}
                    y={ry + 2}
                    width={50}
                    height={22}
                    rx={6}
                    className="fill-white stroke-brand-300"
                    strokeWidth={1.5}
                  />
                  <Label x={287} y={ry + 14} anchor="middle" size={10} weight={600} tone="accent">
                    Revert
                  </Label>
                </g>
              )}
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}
