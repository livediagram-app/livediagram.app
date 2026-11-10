// Share dialog and share-gate scenes for the Collaboration › Sharing articles
// (docs/specs/018-help/help-app.md). Drawn from the live Share dialog
// (apps/editor/components/dialogs/Share*.tsx): every link is a pass with a role-coloured band across its top, the
// composer's fine print holds Opens / Valid / Create Pass, and the password is one switch beneath the
// passes. Labels are the real UI strings.

import { Button, Label, Scene, Shape, TextBar } from '@liveworkspace/help-site/art/primitives';
import { ActivePass, LifetimeControl, SectionLabel, ShareCard } from './sharing-parts';

export {
  SharePasswordSwitch,
  SharePasswordGate,
  ShareLifetimes,
  ShareOpensRow,
  ShareEmbedMenu,
  ShareLiveImageMenu,
} from './sharing-pass-options';

// --- Scenes ------------------------------------------------------------------

/** The Share dialog: Issue a pass (the role picker unfolded to its three roles, Valid, Create Pass)
 *  above the live passes. Mirrors ShareRolePicker: one card naming the chosen role, unfolding the
 *  roles beneath it. */
export function SharePassesDialog() {
  const x = 14;
  const w = 392;
  const roles: { title: string; blurb: string; tile: string; text: string; on: boolean }[] = [
    {
      title: 'Editor',
      blurb: 'Draws with you in real time.',
      tile: 'fill-brand-700',
      text: 'fill-brand-700 dark:fill-brand-300',
      on: true,
    },
    {
      title: 'Participant',
      blurb: "Edits text and comments. Can't add, move or restyle.",
      tile: 'fill-teal-600',
      text: 'fill-teal-800 dark:fill-teal-300',
      on: false,
    },
    {
      title: 'Viewer',
      blurb: "Watches, pans and zooms. Can't comment or change a thing.",
      tile: 'fill-violet-500 dark:fill-violet-700',
      text: 'fill-violet-700 dark:fill-violet-300',
      on: false,
    },
  ];
  const panelX = x + 16;
  const panelW = w - 32;
  return (
    <Scene w={420} h={426} bg="plain">
      <ShareCard x={x} y={8} w={w} h={410} status="Shared: anyone holding the pass can get in.">
        <g transform="translate(0 22)">
          <SectionLabel x={panelX} y={68}>
            ISSUE A PASS
          </SectionLabel>
          {/* One tinted panel holds the role picker and the fine print. */}
          <rect x={panelX} y={76} width={panelW} height={198} rx={10} className="fill-slate-50" />
          <rect
            x={panelX + 8}
            y={84}
            width={panelW - 16}
            height={146}
            rx={9}
            className="fill-brand-50 stroke-brand-500"
            strokeWidth={1.8}
          />
          {/* The picker's header names the chosen role; the chevron points up while it is open. */}
          <rect x={panelX + 18} y={92} width={22} height={22} rx={5} className="fill-brand-700" />
          <Label x={panelX + 50} y={100} size={11} weight={700} tone="strong">
            Editor
          </Label>
          <Label x={panelX + 50} y={112} size={9} tone="muted">
            Draws with you in real time.
          </Label>
          <path
            d={`M${panelX + panelW - 30} ${106} l5 -5 l5 5`}
            className="fill-none stroke-slate-400"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={panelX + 8}
            y1={122}
            x2={panelX + panelW - 8}
            y2={122}
            className="stroke-slate-200"
            strokeWidth={1}
          />
          {roles.map((r, i) => {
            const ry = 127 + i * 33;
            return (
              <g key={r.title}>
                <rect
                  x={panelX + 13}
                  y={ry}
                  width={panelW - 26}
                  height={30}
                  rx={7}
                  className={r.on ? 'fill-white stroke-brand-300' : 'fill-white/70'}
                  strokeWidth={1}
                />
                <rect x={panelX + 19} y={ry + 6} width={18} height={18} rx={4} className={r.tile} />
                <Label x={panelX + 45} y={ry + 12} size={10} weight={700} className={r.text}>
                  {r.title}
                </Label>
                <Label x={panelX + 45} y={ry + 23} size={8.5} tone="muted">
                  {r.blurb}
                </Label>
                {r.on ? (
                  <g>
                    <circle cx={panelX + panelW - 30} cy={ry + 15} r={6} className={r.tile} />
                    <path
                      d={`M${panelX + panelW - 33} ${ry + 15} l2 2 l4 -4`}
                      className="fill-none stroke-white"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ) : null}
              </g>
            );
          })}
          {/* The fine print: Valid, then Create Pass ending the row. */}
          <Label x={panelX + 10} y={253} size={10} weight={600} tone="body">
            Valid
          </Label>
          <LifetimeControl x={panelX + 44} y={240} w={214} active={0} />
          <Button x={panelX + 266} y={240} w={86} h={26} label="Create Pass" variant="primary" />
          <SectionLabel x={panelX} y={294}>
            PASSES
          </SectionLabel>
          <ActivePass x={panelX} y={302} w={panelW} role="edit" />
        </g>
      </ShareCard>
    </Scene>
  );
}

/** The Share dialog's Community tab with a listed post: View Post, Edit Listing and
 *  Remove From Community. */
export function CommunityShareSection() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={170} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={154}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* The dialog's two tabs, Community chosen. */}
      <Label x={x + 20} y={28} size={11} weight={500} tone="muted">
        Passes
      </Label>
      <Label x={x + 76} y={28} size={11} weight={700} tone="accent">
        Community
      </Label>
      <line x1={x + 72} y1={37} x2={x + 140} y2={37} className="stroke-brand-500" strokeWidth={2} />
      <line
        x1={x + 1}
        y1={38}
        x2={x + w - 1}
        y2={38}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <rect
        x={x + 16}
        y={44}
        width={w - 32}
        height={106}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 30} y={64} size={12} weight={600} tone="strong">
        Quarterly report, on one page
      </Label>
      <Label x={x + 30} y={84} size={10} tone="muted">
        Reports · ♥ 12 · Copied 3 times
      </Label>
      <Button x={x + 30} y={108} w={78} h={26} label="View Post" />
      <Button x={x + 116} y={108} w={88} h={26} label="Edit Listing" />
      <Button x={x + 212} y={108} w={150} h={26} label="Remove From Community" />
    </Scene>
  );
}

/** The Community search box: the query as words, the clear cross after them, and My Shares,
 *  Category, Tags (a chosen tag counted) and the sort inside its right edge. */
export function CommunitySearchBox() {
  const chip = (cx: number, label: string, on = false, badge = 0) => (
    <g>
      <rect
        x={cx}
        y={34}
        width={label.length * 5.4 + 12 + (badge ? 13 : 0)}
        height={24}
        rx={7}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1.2}
      />
      <Label x={cx + 6} y={47} size={9.5} weight={600} tone={on ? 'accent' : 'body'}>
        {label}
      </Label>
      {badge ? (
        <g>
          <circle cx={cx + label.length * 5.4 + 15} cy={46} r={5.5} className="fill-brand-500" />
          <Label
            x={cx + label.length * 5.4 + 15}
            y={47}
            anchor="middle"
            size={8}
            weight={700}
            tone="onAccent"
          >
            {badge}
          </Label>
        </g>
      ) : null}
    </g>
  );
  return (
    <Scene w={420} h={176} bg="plain">
      <rect
        x={10}
        y={26}
        width={400}
        height={40}
        rx={12}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <circle cx={28} cy={45} r={5} className="fill-none stroke-slate-400" strokeWidth={1.5} />
      <path d="M32 49 l4 4" className="stroke-slate-400" strokeWidth={1.5} />
      <Label x={44} y={47} size={11} tone="strong">
        #report sort:loved
      </Label>
      {/* The clear cross sits just after the text. */}
      <path
        d="M140 42 l6 6 M146 42 l-6 6"
        className="stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {chip(156, 'My Shares')}
      {chip(222, 'Category')}
      {chip(282, 'Tags', true, 1)}
      {chip(333, 'Most Loved', true)}
      {/* A few result cards. */}
      {[10, 144, 278].map((cx, i) => (
        <g key={cx}>
          <rect
            x={cx}
            y={82}
            width={132}
            height={84}
            rx={10}
            className="fill-white stroke-slate-200"
            strokeWidth={1.5}
          />
          <rect x={cx + 8} y={90} width={116} height={40} rx={6} className="fill-slate-50" />
          <Shape x={cx + 20} y={98} w={36} h={24} accent={i === 0} />
          <Shape x={cx + 76} y={98} w={36} h={24} kind="circle" />
          <TextBar x={cx + 10} y={140} w={84} tone="muted" />
          <Label x={cx + 10} y={156} size={10} tone="muted">
            {['♥ 48', '♥ 31', '♥ 17'][i]}
          </Label>
          <Label x={cx + 122} y={156} anchor="end" size={10} tone="muted">
            {['Copied 9', 'Copied 4', 'Copied 2'][i]}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
