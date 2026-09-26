// Account-and-data category illustrations (docs/specs/018-help/help-app.md): the per-browser guest
// identity, signing in and migrating guest work, exporting diagrams, and
// deleting data. Composed only from the shared primitives so the house style
// holds.

import { Scene, Shape, Arrow, Dialog, Button, Menu, Label, TextBar } from './primitives';

/** A browser window holding a per-browser guest id that owns the diagrams it
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
      <Label x={118} y={41} size={9} tone="muted">
        livediagram.app/new
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
      <Label x={82} y={84} size={9} weight={700} tone="muted">
        GUEST ID
      </Label>
      <Label x={82} y={98} size={11} weight={600} tone="accent">
        livediagram:self-id
      </Label>
      {/* The diagrams it owns */}
      <Label x={70} y={128} size={9} weight={700} tone="muted">
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

/** The sign-in card: email-code and Google options on the custom sign-in UI. */
export function SignInCard() {
  return (
    <Scene w={420} h={240} bg="plain">
      <Dialog
        x={108}
        y={20}
        w={204}
        h={204}
        title="Sign in"
        scrim={false}
        sceneW={420}
        sceneH={240}
      >
        <Label x={124} y={72} size={9} weight={700} tone="muted">
          EMAIL
        </Label>
        <rect
          x={124}
          y={80}
          width={172}
          height={26}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={134} y={94} size={10} tone="muted">
          you@example.com
        </Label>
        <Button x={124} y={116} w={172} label="Continue with email" variant="primary" />
        {/* divider */}
        <line x1={124} y1={160} x2={170} y2={160} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={210} y={161} anchor="middle" size={9} tone="muted">
          or
        </Label>
        <line x1={250} y1={160} x2={296} y2={160} className="stroke-slate-200" strokeWidth={1.5} />
        {/* Google button */}
        <rect
          x={124}
          y={174}
          width={172}
          height={26}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <circle cx={140} cy={187} r={6} className="fill-none stroke-brand-400" strokeWidth={2} />
        <Label x={216} y={188} anchor="middle" size={10} weight={600} tone="body">
          Continue with Google
        </Label>
      </Dialog>
    </Scene>
  );
}

/** Guest diagrams migrating from the per-browser id over to a new account on
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
      <Label x={44} y={80} size={9} weight={700} tone="muted">
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
      <Label x={264} y={73} size={9} weight={700} tone="onAccent">
        YOUR ACCOUNT
      </Label>
      <Shape x={268} y={96} w={50} h={32} kind="rect" />
      <Shape x={328} y={96} w={50} h={32} kind="circle" />
      <TextBar x={268} y={142} w={108} />
      <TextBar x={268} y={154} w={78} tone="faint" />
    </Scene>
  );
}

/** The export menu: PNG, SVG, and PDF image formats plus a live embed option. */
export function ExportMenu() {
  return (
    <Scene w={420} h={230}>
      {/* A diagram behind the menu */}
      <Shape x={36} y={58} w={84} h={48} kind="rect" label="Start" />
      <Shape x={36} y={138} w={84} h={44} kind="rect" accent label="Done" />
      <Arrow from={[78, 106]} to={[78, 138]} />
      {/* The export menu */}
      <Label x={208} y={42} size={10} weight={700} tone="muted">
        EXPORT
      </Label>
      <Menu
        x={196}
        y={50}
        w={188}
        items={['PNG image', 'SVG vector', 'PDF document', 'Embed live view']}
        active={0}
        rowH={32}
      />
    </Scene>
  );
}

/** A delete-confirmation dialog for a single diagram, warning the linked
 *  content goes with it. */
export function DeleteDialog() {
  return (
    <Scene w={420} h={220} bg="plain">
      <Dialog
        x={86}
        y={28}
        w={248}
        h={164}
        title="Delete diagram?"
        scrim={false}
        sceneW={420}
        sceneH={220}
      >
        {/* warning glyph */}
        <g transform="translate(110 84)">
          <path
            d="M0 -10 L11 9 H-11 Z"
            className="fill-rose-100 stroke-rose-400"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Label x={0} y={2} anchor="middle" size={11} weight={700} className="fill-rose-500">
            !
          </Label>
        </g>
        <Label x={132} y={80} size={11} weight={600} tone="strong">
          “System overview”
        </Label>
        <TextBar x={132} y={92} w={170} />
        <Label x={102} y={116} size={9} tone="muted">
          Its tabs, comments, and history
        </Label>
        <Label x={102} y={130} size={9} tone="muted">
          are removed too. This cannot be undone.
        </Label>
        <Button x={102} y={154} w={92} label="Cancel" variant="default" />
        <Button x={206} y={154} w={112} label="Delete" variant="primary" />
      </Dialog>
    </Scene>
  );
}
