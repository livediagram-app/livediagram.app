// The livediagram CLI's sign-in surfaces, drawn for the Developers article on the CLI
// (docs/specs/015-api/cli.md "Authentication"): a terminal running `auth login --device` beside the
// editor's /oauth/device page, and the approval card the browser sign-in opens. Labels are the real
// ones from apps/cli and apps/live/app/oauth. Composed from the shared primitives so the house style
// holds; the terminal stays dark in both appearances, like the code windows elsewhere.

import { Scene, Panel, Button, Label } from './primitives';
import { ConsentCard } from './account-settings';

/** One line of terminal text, monospaced. */
function Mono({
  x,
  y,
  children,
  className = 'fill-slate-200',
}: {
  x: number;
  y: number;
  children: string;
  className?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={10}
      dominantBaseline="middle"
      className={className}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {children}
    </text>
  );
}

/** A terminal window: dark in both appearances. */
function Terminal({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-slate-800 dark:stroke-slate-700"
        strokeWidth={2}
      />
      <rect x={x} y={y} width={w} height={22} rx={10} className="fill-slate-700" />
      <rect x={x} y={y + 12} width={w} height={10} className="fill-slate-700" />
      <circle cx={x + 14} cy={y + 11} r={3} className="fill-rose-400" />
      <circle cx={x + 26} cy={y + 11} r={3} className="fill-amber-400" />
      <circle cx={x + 38} cy={y + 11} r={3} className="fill-emerald-400" />
    </>
  );
}

/** Device sign-in: the terminal prints the page and a code; the person types the code into
 *  Connect a terminal on any device and continues to the approval card. */
export function CliDeviceSignIn() {
  return (
    <Scene w={420} h={220} bg="plain">
      <g className="help-art-as-drawn">
        <Terminal x={10} y={20} w={206} h={180} />
        <Mono x={22} y={56} className="fill-emerald-400">
          $ livediagram auth
        </Mono>
        <Mono x={22} y={72} className="fill-emerald-400">
          {'  login --device'}
        </Mono>
        <Mono x={22} y={96}>
          Open
        </Mono>
        <Mono x={22} y={112} className="fill-brand-300">
          livediagram.app/oauth/device
        </Mono>
        <Mono x={22} y={128}>
          and enter
        </Mono>
        <Mono x={22} y={146} className="fill-amber-400">
          BCDF-GHJK
        </Mono>
        <Mono x={22} y={170} className="fill-slate-400">
          Waiting for approval…
        </Mono>
      </g>

      <Panel x={228} y={20} w={182} h={180}>
        <Label x={242} y={46} size={13} weight={700} tone="strong">
          Connect a terminal
        </Label>
        <Label x={242} y={74} size={10} weight={600} tone="body">
          Code shown in your terminal
        </Label>
        <rect
          x={242}
          y={86}
          width={154}
          height={30}
          rx={7}
          className="fill-white stroke-brand-500"
          strokeWidth={1.5}
        />
        <text
          x={319}
          y={102}
          fontSize={13}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing={2}
          className="fill-slate-800"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          BCDF-GHJK
        </text>
        <Label x={242} y={130} size={10} tone="muted">
          Only enter a code shown by
        </Label>
        <Label x={242} y={143} size={10} tone="muted">
          a terminal you are using.
        </Label>
        <Button x={242} y={160} w={82} h={26} label="Continue" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** The approval card the browser sign-in (and, after the code, the device sign-in) shows: the
 *  Read-only access switch, where the access goes, then Connect. */
export function CliConsent() {
  return (
    <ConsentCard
      title="Connect livediagram CLI"
      intro={[
        'livediagram CLI wants to access your livediagram',
        'documents on your behalf. Approving creates an API token.',
      ]}
      sentTo="127.0.0.1:53124"
    />
  );
}
