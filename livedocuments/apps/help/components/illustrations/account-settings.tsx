// Account-and-data surfaces drawn for the support articles (docs/specs/018-help/help-app.md): the
// Trash view, the API Tokens category of Settings, the MCP connection consent card, and the
// Notifications category. Labels are the real ones from apps/live. Composed only from the shared
// primitives so the house style holds.

import { Scene, Panel, Dialog, Button, Label } from './primitives';
import { Switch } from './settings-dialog';

/** The Trash view: one group per scope, each row with when it was deleted, the
 *  days it has left, Restore and Delete permanently, and Empty Trash per group. */
export function TrashView() {
  const rows: [string, string][] = [
    ['Service map', 'Deleted 2 Oct · 25 days left'],
    ['Untitled document', 'Moved here 1 Oct because it was empty · 24 days left'],
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Panel x={14} y={14} w={392} h={128}>
        <Label x={30} y={36} size={11} weight={700} tone="strong">
          Your documents
        </Label>
        <Label x={392} y={36} anchor="end" size={10} weight={600} tone="muted">
          Empty Trash
        </Label>
        <line x1={14} y1={52} x2={406} y2={52} className="stroke-slate-200" strokeWidth={1.5} />
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
              {/* Restore and Delete permanently sit together at the right, on the name's line. */}
              <Button x={220} y={y} w={58} h={18} label="Restore" />
              <Label x={392} y={y + 10} anchor="end" size={10} weight={600} tone="muted">
                Delete permanently
              </Label>
            </g>
          );
        })}
      </Panel>
      <Panel x={14} y={154} w={392} h={62}>
        <Label x={30} y={176} size={11} weight={700} tone="strong">
          This Browser only
        </Label>
        <Label x={30} y={198} size={10} tone="muted">
          Offline sketch · Deleted 3 Oct · 26 days left
        </Label>
        <Label x={392} y={176} anchor="end" size={10} weight={600} tone="muted">
          Empty Trash
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
          strokeWidth={1.5}
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

/** The consent card an MCP client (Claude) opens. */
export function McpConsent() {
  return (
    <ConsentCard
      title="Connect Claude"
      intro={[
        'Claude wants to access your livedocuments documents',
        'on your behalf. Approving creates an API token.',
      ]}
      sentTo="claude.ai"
    />
  );
}

/** Settings, Account, Notifications: the in-editor switch and the email
 *  switches a signed-in account gets, one whole-row toggle each. */
export function NotificationSettings() {
  const rows: [string, boolean][] = [
    ['Someone Joins My Document', true],
    ['Someone Comments on My Document', true],
    ['Someone Mentions Me in a Comment', true],
    ['Tips and Check-Ins', false],
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Dialog
        x={30}
        y={10}
        w={360}
        h={210}
        title="Account › Notifications"
        sceneW={420}
        sceneH={230}
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
