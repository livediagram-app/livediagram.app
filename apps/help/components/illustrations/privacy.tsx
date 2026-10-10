// Privacy and Security category illustrations (docs/specs/018-help/help-app.md): where documents live on
// Cloudflare, who can read them, the anonymous-telemetry opt-out, and the
// open-source / public-code motif. (Share-link security reuses the Share
// dialog scenes in sharing.tsx.)
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Panel, Dialog, Label, TextBar } from './primitives';

/** A small shield motif with a tick, the recurring "protected" mark. */
function Shield({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 -16 L15 -10 V2 a16 18 0 0 1 -15 18 a16 18 0 0 1 -15 -18 V-10 Z"
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={2}
      />
      <path
        d="M-7 0 l5 5 l9 -11"
        fill="none"
        className="stroke-brand-500"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Where documents live: the browser sends edits through one API to Cloudflare
 *  storage (D1, a Durable Object room, object storage), all behind a shield. */
export function DocumentStorage() {
  return (
    <Scene w={420} h={240}>
      {/* Browser */}
      <Panel x={20} y={84} w={96} h={72} title="BROWSER">
        <Shape x={36} y={120} w={64} h={26} kind="rect" />
      </Panel>

      {/* API worker */}
      <Shape x={158} y={100} w={70} h={40} accent label="API" />
      <Arrow from={[116, 120]} to={[158, 120]} />

      {/* Cloudflare storage stack, behind the shield */}
      <rect
        x={266}
        y={28}
        width={136}
        height={184}
        rx={12}
        className="fill-brand-50/40 stroke-brand-200"
        strokeWidth={2}
        strokeDasharray="6 5"
      />
      <Label x={334} y={44} anchor="middle" size={10} weight={700} tone="muted">
        CLOUDFLARE
      </Label>
      <Shape x={284} y={54} w={100} h={30} kind="cylinder" label="D1" labelTone="strong" />
      <Shape x={284} y={94} w={100} h={30} kind="rect" label="Room" labelTone="strong" />
      <Shape x={284} y={134} w={100} h={30} kind="rect" label="Images (R2)" labelTone="strong" />
      <Arrow from={[228, 110]} to={[284, 75]} kind="curved" tone="muted" />
      <Arrow from={[228, 124]} to={[284, 109]} tone="muted" />
      <Arrow from={[228, 134]} to={[284, 149]} kind="curved" tone="muted" />

      <Shield x={296} y={190} scale={0.7} />
    </Scene>
  );
}

/** Access control: a document is owned by an identity, so a non-owner request
 *  comes back as a plain "not found" rather than confirming it exists. */
export function AccessControl() {
  return (
    <Scene w={420} h={210}>
      {/* The private document, with a lock */}
      <Panel x={150} y={48} w={120} h={108} title="DOCUMENT">
        <Shape x={166} y={88} w={40} h={26} kind="rect" />
        <Shape x={216} y={88} w={40} h={26} kind="circle" accent />
        <g transform="translate(210 124)">
          <rect x={-9} y={-2} width={18} height={13} rx={2} className="fill-brand-500" />
          <path
            d="M-5 -2 v-4 a5 5 0 0 1 10 0 v4"
            fill="none"
            className="stroke-brand-500"
            strokeWidth={2}
          />
        </g>
      </Panel>

      {/* Owner, allowed in */}
      <Label x={20} y={64} size={10} weight={600} tone="body">
        Owner
      </Label>
      <Arrow from={[60, 80]} to={[150, 92]} tone="accent" />

      {/* Stranger, refused */}
      <Label x={20} y={150} size={10} weight={600} tone="body">
        Not the owner
      </Label>
      <Arrow from={[88, 150]} to={[150, 128]} tone="muted" dashed head={false} />
      <g transform="translate(118 138)">
        <circle r={12} className="fill-rose-50 stroke-rose-400" strokeWidth={2} />
        <path d="M-5 -5 l10 10 M5 -5 l-10 10" className="stroke-rose-400" strokeWidth={2} />
      </g>
      <rect
        x={300}
        y={120}
        width={104}
        height={30}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={352} y={136} anchor="middle" size={11} weight={600} tone="muted">
        404 Not found
      </Label>
      <Arrow from={[270, 135]} to={[300, 135]} tone="muted" />
    </Scene>
  );
}

/** The Settings dialog open on its Privacy category, with Send Anonymous Usage
 *  Events switched off. */
export function TelemetryToggle() {
  const cats = ['Editor', 'Appearance', 'Panels', 'Account', 'Privacy'];
  return (
    <Scene w={420} h={220} bg="plain">
      <Dialog
        x={30}
        y={18}
        w={360}
        h={184}
        title="Settings"
        sceneW={420}
        sceneH={220}
        scrim={false}
      >
        {/* Category list, Privacy selected */}
        {cats.map((c, i) => {
          const y = 66 + i * 26;
          const active = c === 'Privacy';
          return (
            <g key={c}>
              {active ? (
                <rect x={40} y={y - 11} width={104} height={22} rx={6} className="fill-brand-50" />
              ) : null}
              <Label
                x={52}
                y={y}
                size={11}
                weight={active ? 700 : 500}
                tone={active ? 'accent' : 'body'}
              >
                {c}
              </Label>
            </g>
          );
        })}
        <line x1={154} y1={54} x2={154} y2={192} className="stroke-slate-200" strokeWidth={1.5} />

        {/* The one Privacy row */}
        <Label x={170} y={72} size={11} weight={600} tone="strong">
          Send Anonymous Usage Events
        </Label>
        <g transform="translate(336 60)">
          <rect
            width={40}
            height={22}
            rx={11}
            className="fill-slate-200 stroke-slate-300"
            strokeWidth={1.5}
          />
          <circle cx={11} cy={11} r={8} className="fill-white stroke-slate-300" strokeWidth={1.5} />
        </g>
        <TextBar x={170} y={98} w={196} tone="faint" />
        <TextBar x={170} y={110} w={176} tone="faint" />
        <TextBar x={170} y={122} w={120} tone="faint" />
      </Dialog>
    </Scene>
  );
}

/** A public, MIT-licensed codebase: an open repository panel of readable source
 *  with no hidden secrets, marked as auditable. */
export function PublicCode() {
  return (
    <Scene w={420} h={210}>
      <Panel x={70} y={26} w={280} h={158} title="REPOSITORY (PUBLIC)">
        {/* Open-book / visible glyph */}
        <g transform="translate(94 66)">
          <circle r={9} className="fill-none stroke-brand-500" strokeWidth={2} />
          <circle r={3} className="fill-brand-500" />
          <path
            d="M-15 0 a17 12 0 0 1 30 0 a17 12 0 0 1 -30 0"
            fill="none"
            className="stroke-brand-300"
            strokeWidth={1.5}
          />
        </g>
        <Label x={116} y={67} size={10} weight={600} tone="strong">
          MIT licensed
        </Label>

        {/* Source lines */}
        <TextBar x={94} y={98} w={220} />
        <TextBar x={110} y={112} w={150} tone="faint" />
        <TextBar x={110} y={126} w={184} tone="faint" />
        <TextBar x={94} y={140} w={120} />
        <TextBar x={110} y={154} w={166} tone="faint" />
      </Panel>
    </Scene>
  );
}
