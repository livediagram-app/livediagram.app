// The account and privacy scenes in liveplanner's words (getting-started/guest-vs-account,
// account-and-data/signing-in, privacy-and-security/data-privacy): the platform's own pictures, with a plan's
// board standing in for the work wherever the shared kit draws a diagram.

import {
  Arrow,
  Avatar,
  Label,
  Panel,
  Scene,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';
import { MiniBoard } from './board-fragment';

/** Side-by-side comparison: a guest tied to one browser versus an account that
 *  syncs the same library across devices. */
export function GuestVsAccount() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Guest side */}
      <rect
        x={20}
        y={20}
        width={180}
        height={200}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={110} y={40} anchor="middle" size={12} weight={700} tone="strong">
        Guest
      </Label>
      <Label x={110} y={56} anchor="middle" size={10} weight={600} tone="muted">
        SAVED IN THIS BROWSER
      </Label>
      {/* Single browser window */}
      <rect
        x={56}
        y={78}
        width={108}
        height={92}
        rx={9}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <rect x={56} y={78} width={108} height={18} rx={9} className="fill-slate-100" />
      <circle cx={68} cy={87} r={2.5} className="fill-slate-300" />
      <circle cx={77} cy={87} r={2.5} className="fill-slate-300" />
      <MiniBoard x={66} y={104} w={88} h={56} />
      <Label x={110} y={196} anchor="middle" size={10} tone="muted">
        Per-browser id
      </Label>

      {/* Account side */}
      <rect
        x={220}
        y={20}
        width={180}
        height={200}
        rx={12}
        className="fill-white stroke-brand-300"
        strokeWidth={0.75}
      />
      <Label x={310} y={40} anchor="middle" size={12} weight={700} tone="accent">
        Account
      </Label>
      <Label x={310} y={56} anchor="middle" size={10} weight={600} tone="muted">
        SYNCED ACROSS DEVICES
      </Label>
      {/* Cloud syncing two devices */}
      <path
        d="M286 86 a13 13 0 0 1 25 -4 a11 11 0 0 1 9 19 h-30 a11 11 0 0 1 -4 -15 Z"
        className="fill-brand-100 stroke-brand-400"
        strokeWidth={1}
      />
      {/* Laptop device */}
      <rect
        x={236}
        y={132}
        width={64}
        height={40}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <rect x={230} y={172} width={76} height={6} rx={3} className="fill-slate-200" />
      <MiniBoard x={241} y={136} w={54} h={32} className="fill-white" />
      {/* Phone device */}
      <rect
        x={328}
        y={130}
        width={32}
        height={48}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <MiniBoard x={332} y={136} w={24} h={36} cols={1} className="fill-white" />
      {/* sync links from cloud to devices */}
      <Arrow from={[296, 104]} to={[270, 130]} tone="accent" head={false} width={2} dashed />
      <Arrow from={[316, 104]} to={[344, 126]} tone="accent" head={false} width={2} dashed />
      <Avatar cx={310} cy={200} r={11} initial="A" colour="brand" />
    </Scene>
  );
}

/** Guest work migrating from the per-browser id over to a new account on
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
        strokeWidth={0.75}
      />
      <Label x={44} y={80} size={10} weight={700} tone="muted">
        GUEST ID
      </Label>
      <MiniBoard x={44} y={88} w={110} h={40} cols={4} />
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
      <MiniBoard x={268} y={92} w={110} h={40} cols={4} />
      <TextBar x={268} y={142} w={108} />
      <TextBar x={268} y={154} w={78} tone="faint" />
    </Scene>
  );
}

/** Access control: a piece of work (`noun`) is owned by an identity, so a non-owner request
 *  comes back as a plain "not found" rather than confirming it exists. */
export function AccessControl({ noun }: { noun: string }) {
  return (
    <Scene w={420} h={210}>
      {/* The private work, with a lock */}
      <Panel x={150} y={48} w={120} h={108} title={noun.toUpperCase()}>
        <MiniBoard x={164} y={84} w={92} h={44} />
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
      <Label x={20} y={178} size={10} weight={600} tone="body">
        No access
      </Label>
      <Arrow from={[60, 166]} to={[150, 128]} tone="muted" dashed head={false} />
      <g transform="translate(104 148)">
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
        strokeWidth={0.75}
      />
      <Label x={352} y={136} anchor="middle" size={11} weight={600} tone="muted">
        404 Not found
      </Label>
      <Arrow from={[270, 135]} to={[300, 135]} tone="muted" />
    </Scene>
  );
}
