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
    ['Untitled document', 'Moved here 1 Oct because it was empty'],
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
          const y = 60 + i * 40;
          return (
            <g key={name}>
              <rect x={28} y={y + 6} width={22} height={22} rx={5} className="fill-slate-100" />
              <Label x={60} y={y + 12} size={11} weight={600} tone="strong">
                {name}
              </Label>
              <Label x={60} y={y + 26} size={10} tone="muted">
                {meta}
              </Label>
              {i === 0 ? (
                <>
                  <Button x={260} y={y + 6} w={58} h={22} label="Restore" />
                  <Label x={392} y={y + 18} anchor="end" size={10} weight={600} tone="muted">
                    Delete permanently
                  </Label>
                </>
              ) : null}
            </g>
          );
        })}
      </Panel>
      <Panel x={14} y={154} w={392} h={62}>
        <Label x={30} y={176} size={11} weight={700} tone="strong">
          This browser only
        </Label>
        <Label x={30} y={196} size={10} tone="muted">
          Offline documents, kept only in this browser.
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
export function ApiTokensList() {
  return (
    <Scene w={420} h={220} bg="plain">
      <Panel x={30} y={14} w={360} h={192}>
        <Label x={48} y={40} size={13} weight={700} tone="strong">
          API Tokens
        </Label>
        <Button x={312} y={27} w={60} h={24} label="New" />
        {/* Slot meter: 2 of 10 in use */}
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            x={48 + i * 32}
            y={60}
            width={28}
            height={6}
            rx={3}
            className={i < 2 ? 'fill-brand-500' : 'fill-slate-200'}
          />
        ))}
        {/* One token card */}
        <rect
          x={48}
          y={82}
          width={324}
          height={104}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={64} y={104} size={12} weight={600} tone="strong">
          Claude
        </Label>
        <rect x={116} y={95} width={70} height={18} rx={9} className="fill-slate-100" />
        <Label x={151} y={105} anchor="middle" size={10} weight={600} tone="body">
          Read-only
        </Label>
        {/* Revoke bin */}
        <g transform="translate(350 104)">
          <path
            d="M-6 -4 H6 M-4 -4 V7 H4 V-4 M-2 -7 H2"
            className="fill-none stroke-slate-400"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <Label x={64} y={128} size={10} tone="muted">
          Created 7 Oct 2026 ·
        </Label>
        <circle cx={176} cy={128} r={3} className="fill-emerald-500" />
        <Label x={184} y={128} size={10} tone="muted">
          Used 2 hours ago
        </Label>
        {/* Lifetime bar */}
        <rect x={64} y={146} width={292} height={6} rx={3} className="fill-slate-100" />
        <rect x={64} y={146} width={36} height={6} rx={3} className="fill-brand-500" />
        <Label x={64} y={170} size={10} weight={600} className="fill-emerald-600">
          Active
        </Label>
        <Label x={356} y={170} anchor="end" size={10} tone="muted">
          Expires in 5 months
        </Label>
      </Panel>
    </Scene>
  );
}

/** The consent card an OAuth client opens (an MCP client, the CLI): Connect <client>, what it
 *  asks for, the Read-only access switch, where access will be sent, and Connect / Cancel. */
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
          Find and view, but not change anything
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
        'Claude wants to access your livediagram documents',
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
