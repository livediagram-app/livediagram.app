// Account-and-data category illustrations (docs/specs/018-help/help-app.md): the per-browser guest
// identity, and signing in and migrating guest work. Composed only from the shared primitives so the house style
// holds.

import { Scene, Shape, Arrow, Panel, Button, Label, TextBar } from './primitives';

/** A browser window holding a per-browser guest id that owns the projects it
 *  created, with no sign-in required. */
export function GuestIdentity() {
  return (
    <Scene w={420} h={230} bg="plain">
      {/* Browser chrome */}
      <rect
        x={48}
        y={28}
        width={324}
        height={174}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <path
        d="M48 40 a12 12 0 0 1 12 -12 H360 a12 12 0 0 1 12 12 V52 H48 Z"
        className="fill-slate-50"
      />
      <circle cx={64} cy={40} r={3} className="fill-rose-400" />
      <circle cx={76} cy={40} r={3} className="fill-amber-400" />
      <circle cx={88} cy={40} r={3} className="fill-emerald-400" />
      <rect
        x={108}
        y={33}
        width={210}
        height={14}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={118} y={41} size={10} tone="muted">
        liveplanner.app/new
      </Label>
      {/* The stored guest id */}
      <rect
        x={70}
        y={70}
        width={170}
        height={36}
        rx={8}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={82} y={84} size={10} weight={700} tone="muted">
        GUEST ID
      </Label>
      <Label x={82} y={98} size={11} weight={600} tone="accent">
        liveplanner:v2:self-id
      </Label>
      {/* The projects it owns */}
      <Label x={70} y={128} size={10} weight={700} tone="muted">
        OWNS
      </Label>
      <Shape x={70} y={138} w={64} h={40} kind="rect" label="A" />
      <Shape x={146} y={138} w={64} h={40} kind="diamond" />
      <Arrow from={[155, 106]} to={[120, 138]} kind="curved" tone="muted" />
      <Arrow from={[170, 106]} to={[178, 138]} kind="curved" tone="muted" />
      {/* No sign-in needed */}
      <rect
        x={262}
        y={138}
        width={92}
        height={40}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={308} y={154} anchor="middle" size={10} weight={600} tone="muted">
        No sign-in
      </Label>
      <Label x={308} y={167} anchor="middle" size={10} weight={600} tone="muted">
        required
      </Label>
    </Scene>
  );
}

/** The sign-in card as /sign-in draws it: the brand and subtitle, Continue
 *  with Google (only where Google sign-in is enabled), an "or" divider, then
 *  the email field and Continue with email. */
export function SignInCard() {
  return (
    <Scene w={420} h={250} bg="plain">
      <Panel x={98} y={14} w={224} h={222}>
        <Label x={210} y={38} anchor="middle" size={14} weight={700} tone="strong">
          liveplanner
        </Label>
        <Label x={210} y={56} anchor="middle" size={10} tone="muted">
          Sign in to keep your projects
        </Label>
        <Label x={210} y={69} anchor="middle" size={10} tone="muted">
          and work across multiple devices.
        </Label>
        {/* Google button (Google sign-in enabled) */}
        <rect
          x={114}
          y={84}
          width={192}
          height={28}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <circle cx={132} cy={98} r={6} className="fill-none stroke-brand-400" strokeWidth={2} />
        <Label x={216} y={99} anchor="middle" size={11} weight={600} tone="body">
          Continue with Google
        </Label>
        {/* divider */}
        <line x1={114} y1={128} x2={196} y2={128} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={210} y={129} anchor="middle" size={10} tone="muted">
          OR
        </Label>
        <line x1={224} y1={128} x2={306} y2={128} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={114} y={150} size={10} weight={600} tone="body">
          Email
        </Label>
        <rect
          x={114}
          y={158}
          width={192}
          height={26}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={124} y={172} size={10} tone="muted">
          you@example.com
        </Label>
        <Button x={114} y={194} w={192} h={28} label="Continue with email" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** Guest projects migrating from the per-browser id over to a new account on
 *  sign-up. */
export function MigrateOnSignUp() {
  return (
    <Scene w={420} h={210} bg="plain">
      {/* Guest browser id, left */}
      <rect
        x={28}
        y={62}
        width={140}
        height={108}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={44} y={80} size={10} weight={700} tone="muted">
        GUEST ID
      </Label>
      <Shape x={44} y={92} w={50} h={32} kind="rect" />
      <Shape x={104} y={92} w={50} h={32} kind="circle" />
      <TextBar x={44} y={138} w={108} />
      <TextBar x={44} y={150} w={78} tone="faint" />
      {/* Migration arrow */}
      <Arrow from={[176, 116]} to={[244, 116]} kind="straight" tone="accent" width={3} />
      <Label x={210} y={104} anchor="middle" size={10} weight={600} tone="accent">
        migrate
      </Label>
      {/* Account, right */}
      <rect
        x={252}
        y={62}
        width={140}
        height={108}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d="M252 72 a10 10 0 0 1 10 -10 H382 a10 10 0 0 1 10 10 V84 H252 Z"
        className="fill-brand-500"
      />
      <Label x={264} y={73} size={10} weight={700} tone="onAccent">
        YOUR ACCOUNT
      </Label>
      <Shape x={268} y={96} w={50} h={32} kind="rect" />
      <Shape x={328} y={96} w={50} h={32} kind="circle" />
      <TextBar x={268} y={142} w={108} />
      <TextBar x={268} y={154} w={78} tone="faint" />
    </Scene>
  );
}
