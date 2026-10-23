// Account-and-data surfaces drawn for the support articles (docs/specs/018-help/help-app.md): the
// Trash view, the API Tokens category of Settings, the MCP connection consent card, and the
// Notifications category. Labels are the real ones from apps/editor. Composed only from the shared
// primitives so the house style holds.

import { Scene, Panel, Dialog, Button, Label } from './primitives';
import { Switch } from './settings-dialog';

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
