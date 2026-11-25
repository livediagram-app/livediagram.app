// Account-and-data surfaces drawn for the support articles (liveworkspace/docs/specs/017-help/help-centre.md): the
// Trash view, the API Tokens category of Settings, the MCP connection consent card, and the
// Notifications category. Labels are the real ones from the editor. Composed only from the shared
// primitives so the house style holds.

import { Scene, Panel, Dialog, Button, Label } from '../primitives';
import { capital, plural } from '../noun';
import { Switch } from './settings-dialog';

/** The Trash view: one group per scope, each row with when it was deleted, the
 *  days it has left, Restore and Delete Forever, and Empty Trash per group. */
export function TrashView({ noun }: { noun: string }) {
  const rows: [string, string][] = [
    ['Service map', 'Deleted 2 Oct · 25 days left'],
    [`Untitled ${noun}`, 'Moved here 1 Oct because it was empty · 24 days left'],
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Panel x={14} y={14} w={392} h={128}>
        <Label x={30} y={36} size={11} weight={700} tone="strong">
          {`Your ${plural(noun)}`}
        </Label>
        <Label x={392} y={36} anchor="end" size={10} weight={600} tone="muted">
          Empty Trash
        </Label>
        <line x1={14} y1={52} x2={406} y2={52} className="stroke-slate-200" strokeWidth={0.75} />
        {rows.map(([name, meta], i) => {
          const y = 58 + i * 42;
          return (
            <g key={name}>
              <rect x={28} y={y + 6} width={22} height={22} rx={5} className="fill-slate-100" />
              <Label x={60} y={y + 11} size={11} weight={600} tone="strong">
                {name}
              </Label>
              <Label x={60} y={y + 31} size={10} tone="muted">
                {meta}
              </Label>
              {/* Restore and Delete Forever sit together at the right, on the name's line. */}
              <Button x={220} y={y} w={58} h={18} label="Restore" />
              <Label x={392} y={y + 10} anchor="end" size={10} weight={600} tone="muted">
                Delete Forever
              </Label>
            </g>
          );
        })}
      </Panel>
      <Panel x={14} y={154} w={392} h={62}>
        <Label x={30} y={176} size={11} weight={700} tone="strong">
          Offline
        </Label>
        <Label x={392} y={176} anchor="end" size={10} tone="muted">
          Open one to restore or delete it.
        </Label>
        <Label x={30} y={198} size={10} tone="muted">
          Offline sketch · Deleted 3 Oct · 26 days left
        </Label>
      </Panel>
    </Scene>
  );
}

/** The API Tokens category of Settings: the slot meter, then a token card with
 *  its badge, dates, the last-used dot, the Revoke bin and the lifetime bar with its status. */
export function ConsentCard({
  title,
  intro,
  sentTo,
}: {
  title: string;
  intro: [string, string];
  sentTo: string;
}) {
  return (
    <Scene w={420} h={240} bg="plain">
      <Panel x={40} y={12} w={340} h={216}>
        <Label x={60} y={40} size={14} weight={700} tone="strong">
          {title}
        </Label>
        <Label x={60} y={62} size={10} tone="body">
          {intro[0]}
        </Label>
        <Label x={60} y={76} size={10} tone="body">
          {intro[1]}
        </Label>
        {/* Read-only access row */}
        <rect
          x={58}
          y={92}
          width={304}
          height={48}
          rx={8}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
        <Label x={72} y={110} size={11} weight={600} tone="strong">
          Read-only access
        </Label>
        <Label x={72} y={126} size={10} tone="muted">
          Find and view, but not create, edit, delete or share
        </Label>
        <Switch x={316} y={106} on={false} size="md" />
        {/* Redirect host */}
        <rect x={58} y={150} width={304} height={24} rx={6} className="fill-slate-50" />
        <Label x={70} y={163} size={10} tone="muted">
          {`Access will be sent to ${sentTo}`}
        </Label>
        <Button x={58} y={186} w={82} h={28} label="Connect" variant="primary" />
        <Button x={148} y={186} w={72} h={28} label="Cancel" />
      </Panel>
    </Scene>
  );
}

/** The one approval page an MCP client (Claude) opens on liveworkspace.app: the client isn't made by liveworkspace,
 *  so a warning names where the access goes; then every app, ticked, the Read-only access switch, Cancel and Connect
 *  (liveworkspace/apps/site/components/account/McpConsent.tsx). `product` is drawn first, as the help's own app. */
export function McpConsent({ product }: { product: string; noun?: string }) {
  const all: [string, string][] = [
    ['livediagram', 'Diagrams'],
    ['livedocuments', 'Slide decks, articles, infographics'],
    ['liveplanner', 'Plans, boards, sheets, forms'],
    ['livedesign', 'Designs'],
  ];
  const apps = [...all.filter(([a]) => a === product), ...all.filter(([a]) => a !== product)];
  return (
    <Scene w={420} h={372} bg="plain">
      <Panel x={40} y={12} w={340} h={348}>
        <Label x={60} y={40} size={14} weight={700} tone="strong">
          Connect Claude
        </Label>
        <Label x={60} y={62} size={10} tone="body">
          Claude wants access to your liveworkspace apps.
        </Label>
        <Label x={60} y={76} size={10} tone="body">
          Revoke it any time in Settings.
        </Label>
        {/* The warning every registered client gets: who made it and where the access goes. */}
        <rect
          x={58}
          y={88}
          width={304}
          height={44}
          rx={6}
          className="fill-amber-50 stroke-amber-200"
          strokeWidth={0.75}
        />
        <Label x={70} y={104} size={10} weight={600} tone="strong">
          Claude isn’t made by liveworkspace.
        </Label>
        <Label x={70} y={120} size={10} tone="body">
          Access goes to claude.ai. Only continue if you started this.
        </Label>
        <Label x={60} y={152} size={10} weight={600} tone="body">
          Apps it can use
        </Label>
        <rect
          x={58}
          y={160}
          width={304}
          height={apps.length * 26}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
        {apps.map(([app, makes], i) => {
          const y = 160 + i * 26;
          return (
            <g key={app}>
              <rect x={68} y={y + 7} width={12} height={12} rx={2.5} className="fill-brand-500" />
              <path
                d={`M${71} ${y + 13} l2.5 2.5 l4.5 -5`}
                className="fill-none stroke-white help-art-as-drawn"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Label x={88} y={y + 14} size={10} weight={600} tone="strong">
                {app}
              </Label>
              <Label x={356} y={y + 14} anchor="end" size={9} tone="muted">
                {makes}
              </Label>
            </g>
          );
        })}
        <Label x={60} y={278} size={11} weight={600} tone="strong">
          Read-only access
        </Label>
        <Label x={60} y={294} size={10} tone="muted">
          View your items, but not change them.
        </Label>
        <Switch x={316} y={274} on={false} size="md" />
        <Button x={58} y={316} w={72} h={28} label="Cancel" />
        <Button x={138} y={316} w={82} h={28} label="Connect" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** Settings, Notifications (under the Account heading): the in-editor switch and the email
 *  switches a signed-in account gets, one whole-row toggle each. */
export function NotificationSettings({ noun }: { noun: string }) {
  const rows: [string, boolean][] = [
    ['Someone Comments on My Work', true],
    ['Someone Mentions Me in a Comment', true],
    [`Someone Joins My ${capital(noun)}`, true],
    ['Someone Assigns Me an Action', true],
    ['Someone Responds to a Team Invite', true],
    ['Tips and Check-Ins', true],
    ['Milestones', true],
  ];
  return (
    <Scene w={420} h={314} bg="plain">
      <Dialog
        x={30}
        y={10}
        w={360}
        h={294}
        title="Notifications"
        sceneW={420}
        sceneH={314}
        scrim={false}
      >
        <Label x={50} y={64} size={10} weight={700} tone="muted">
          IN THE EDITOR
        </Label>
        <Label x={50} y={86} size={11} weight={600} tone="strong">
          In-Editor Notifications
        </Label>
        <Switch x={336} y={76} on size="md" />
        <Label x={50} y={112} size={10} weight={700} tone="muted">
          EMAIL
        </Label>
        {rows.map(([label, on], i) => {
          const y = 134 + i * 22;
          return (
            <g key={label}>
              <Label x={50} y={y} size={11} weight={500} tone="body">
                {label}
              </Label>
              <Switch x={336} y={y - 10} on={on} size="md" />
            </g>
          );
        })}
      </Dialog>
    </Scene>
  );
}
