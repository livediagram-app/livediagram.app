// Privacy and Security category illustrations (docs/specs/018-help/help-app.md): where diagrams live on
// Cloudflare, who can read them, the anonymous-telemetry opt-out, share-link
// controls (password + expiry), and the open-source / public-code motif.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Panel, Dialog, Button, Label, TextBar } from './primitives';

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

/** Where diagrams live: the browser sends edits through one API to Cloudflare
 *  storage (D1, a Durable Object room, object storage), all behind a shield. */
export function DiagramStorage() {
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
      <Label x={334} y={44} anchor="middle" size={8} weight={700} tone="muted">
        CLOUDFLARE
      </Label>
      <Shape x={284} y={54} w={100} h={30} kind="cylinder" label="D1" labelTone="strong" />
      <Shape x={284} y={94} w={100} h={30} kind="rect" label="Room" labelTone="strong" />
      <Shape x={284} y={134} w={100} h={30} kind="rect" label="Images" labelTone="strong" />
      <Arrow from={[228, 110]} to={[284, 75]} kind="curved" tone="muted" />
      <Arrow from={[228, 124]} to={[284, 109]} tone="muted" />
      <Arrow from={[228, 134]} to={[284, 149]} kind="curved" tone="muted" />

      <Shield x={296} y={190} scale={0.7} />
    </Scene>
  );
}

/** Access control: a diagram is owned by an identity, so a non-owner request
 *  comes back as a plain "not found" rather than confirming it exists. */
export function AccessControl() {
  return (
    <Scene w={420} h={210}>
      {/* The private diagram, with a lock */}
      <Panel x={150} y={48} w={120} h={108} title="DIAGRAM">
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

/** The Settings panel with the anonymous-telemetry row and its opt-out switch
 *  turned off. */
export function TelemetryToggle() {
  return (
    <Scene w={420} h={210} bg="plain">
      <Dialog
        x={70}
        y={26}
        w={280}
        h={158}
        title="Settings"
        sceneW={420}
        sceneH={210}
        scrim={false}
      >
        <Label x={86} y={76} size={8} weight={700} tone="muted">
          PRIVACY
        </Label>

        {/* Telemetry row */}
        <Label x={86} y={102} size={10} weight={600} tone="strong">
          Anonymous telemetry
        </Label>
        <TextBar x={86} y={116} w={150} tone="faint" />

        {/* Toggle switch, off */}
        <g transform="translate(286 92)">
          <rect
            width={44}
            height={24}
            rx={12}
            className="fill-slate-200 stroke-slate-300"
            strokeWidth={1.5}
          />
          <circle cx={12} cy={12} r={9} className="fill-white stroke-slate-300" strokeWidth={1.5} />
        </g>
        <Label x={308} y={130} anchor="middle" size={10} weight={600} tone="muted">
          Off
        </Label>

        <Button x={250} y={150} w={84} label="Done" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** The Share dialog hardened with both controls at once: a password on the
 *  diagram and an expiry on the link. */
export function ShareLinkControls() {
  const dx = 56;
  const dy = 18;
  const dw = 308;
  const dh = 204;
  return (
    <Scene w={420} h={240} bg="plain">
      <Dialog x={dx} y={dy} w={dw} h={dh} title="Share" sceneW={420} sceneH={240} scrim={false}>
        {/* Share link row with an expiry pill */}
        <rect
          x={dx + 16}
          y={dy + 48}
          width={44}
          height={26}
          rx={7}
          className="fill-brand-500 stroke-brand-600"
          strokeWidth={1.5}
        />
        <Label x={dx + 30} y={dy + 61} anchor="middle" size={10} weight={600} tone="onAccent">
          Edit
        </Label>
        <rect
          x={dx + 68}
          y={dy + 48}
          width={140}
          height={26}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={dx + 78} y={dy + 61} size={10} tone="muted">
          livediagram.app/d/…
        </Label>
        {/* Expiry pill on the link */}
        <rect
          x={dx + 216}
          y={dy + 48}
          width={76}
          height={26}
          rx={7}
          className="fill-white stroke-brand-500"
          strokeWidth={2}
        />
        <Label x={dx + 254} y={dy + 61} anchor="middle" size={10} weight={600} tone="accent">
          1 Month
        </Label>

        {/* Password section */}
        <line
          x1={dx}
          y1={dy + 92}
          x2={dx + dw}
          y2={dy + 92}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={dx + 16} y={dy + 108} size={8} weight={700} tone="muted">
          PASSWORD
        </Label>
        <rect
          x={dx + 16}
          y={dy + 120}
          width={dw - 110}
          height={26}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={dx + 28} y={dy + 134} size={11} tone="body">
          spring-otter-42
        </Label>
        <Button x={dx + dw - 80} y={dy + 120} w={64} h={26} label="Save" variant="primary" />

        {/* Inactive links note */}
        <line
          x1={dx}
          y1={dy + 162}
          x2={dx + dw}
          y2={dy + 162}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={dx + 16} y={dy + 178} size={8} weight={700} tone="muted">
          INACTIVE SHARE LINKS
        </Label>
        <TextBar x={dx + 16} y={dy + 190} w={120} tone="faint" />
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
