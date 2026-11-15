// The Calendar Feed article's scenes (docs/specs/026-plan/calendar-feed.md "Subscribe to Calendar"): the tab menu with
// Subscribe to Calendar… under the pointer, the dialog's Just made state (the link shown once, its calendars, What It
// Shows and the privacy note), and the cards landing in a calendar week as all-day events. Composed from the shared
// primitives so the house style holds.

import { Scene, Label, Dialog, Button } from '@liveworkspace/help-site/art/primitives';
import { Switch } from '@liveworkspace/help-site/art/illustrations/settings-dialog';
import {
  TabPill,
  AddTabButton,
  TabBar,
  MenuRowList,
} from '@liveworkspace/help-site/art/illustrations/tabs-parts';

/** The tab menu's rows, with Subscribe to Calendar… under the pointer beside Export and Clear. */
export function CalendarFeedMenu() {
  const barY = 158;
  const mx = 130;
  const my = 26;
  return (
    <Scene w={420} h={210}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={80} label="Roadmap" active />
      <TabPill x={100} y={barY + 8} w={64} label="Bugs" />
      <AddTabButton x={170} y={barY + 8} />
      <rect
        x={mx}
        y={my}
        width={212}
        height={110}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList
        x={mx}
        y={my + 6}
        w={212}
        rows={[
          'Organise in Tab Folder',
          null,
          'Import…',
          'Export',
          'Subscribe to Calendar…',
          'Clear',
        ]}
        highlight="Subscribe to Calendar…"
      />
    </Scene>
  );
}

/** Subscribe to Calendar just after Make Calendar Link: the link with Copy Link, Google Calendar and Apple Calendar,
 *  What It Shows (Board, Only My Cards, Include Done Cards) and the amber privacy note. */
export function CalendarFeedDialog() {
  const W = 420;
  const H = 300;
  const dx = 30;
  const dy = 8;
  const dw = 360;
  const x = dx + 16;
  const w = dw - 32;
  const row = (y: number, label: string, on: boolean) => (
    <g key={label}>
      <Label x={x + 4} y={y + 8} size={10} weight={600} tone="strong">
        {label}
      </Label>
      <Switch x={x + w - 30} y={y} on={on} />
    </g>
  );
  return (
    <Scene w={W} h={H}>
      <Dialog
        x={dx}
        y={dy}
        w={dw}
        h={H - 16}
        title="Subscribe to Calendar"
        sceneW={W}
        sceneH={H}
        scrim={false}
      >
        {/* The link, shown this once, and Copy Link. */}
        <rect
          x={x}
          y={dy + 48}
          width={w - 86}
          height={24}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
        />
        <Label x={x + 8} y={dy + 61} size={9} tone="body" className="fill-slate-600 font-mono">
          …/api/calendar/…/lpf_7Kq…ics
        </Label>
        <Button x={x + w - 78} y={dy + 47} w={78} label="Copy Link" variant="primary" />
        <Label x={x} y={dy + 92} size={9.5} tone="muted">
          Add it to
        </Label>
        <Button x={x + 48} y={dy + 82} w={102} h={20} label="Google Calendar" />
        <Button x={x + 156} y={dy + 82} w={96} h={20} label="Apple Calendar" />
        {/* What It Shows. */}
        <Label x={x} y={dy + 124} size={9} weight={700} tone="muted">
          WHAT IT SHOWS
        </Label>
        <Label x={x + 4} y={dy + 144} size={10} weight={600} tone="strong">
          Board
        </Label>
        <rect
          x={x + w - 110}
          y={dy + 135}
          width={110}
          height={18}
          rx={4}
          className="fill-white stroke-slate-300"
        />
        <Label x={x + w - 102} y={dy + 145} size={9.5} tone="body">
          All Boards
        </Label>
        <path
          d={`M${x + w - 14} ${dy + 142}l3 3 3-3`}
          fill="none"
          className="stroke-slate-400"
          strokeWidth={1.4}
        />
        {row(dy + 162, 'Only My Cards', true)}
        {row(dy + 186, 'Include Done Cards', false)}
        {/* The privacy note. */}
        <rect
          x={x}
          y={dy + 212}
          width={w}
          height={44}
          rx={7}
          className="fill-amber-50 stroke-amber-200"
        />
        <Label x={x + 12} y={dy + 228} size={9.5} weight={600} className="fill-amber-900">
          Anyone with this link can see the cards’ titles and dates.
        </Label>
        <Label x={x + 12} y={dy + 244} size={9.5} className="fill-amber-900">
          Don’t share it. If it leaks, press Reset Link.
        </Label>
      </Dialog>
    </Scene>
  );
}

/** A calendar week with the plan's cards in it: all-day events titled with each card's number and title, a span from
 *  Start to Due, beside the person's own meetings. */
export function CalendarFeedWeek() {
  const W = 420;
  const H = 190;
  const x0 = 20;
  const top = 34;
  const col = 76;
  const days = ['Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13'];
  const event = (from: number, to: number, y: number, label: string, tone: string) => (
    <g key={label}>
      <rect
        x={x0 + from * col + 3}
        y={y}
        width={(to - from + 1) * col - 6}
        height={18}
        rx={4}
        className={tone}
      />
      <Label x={x0 + from * col + 10} y={y + 10} size={9.5} weight={600} className="fill-white">
        {label}
      </Label>
    </g>
  );
  return (
    <Scene w={W} h={H}>
      <rect
        x={x0}
        y={8}
        width={col * 5}
        height={H - 18}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {days.map((d, i) => (
        <g key={d}>
          <Label
            x={x0 + i * col + col / 2}
            y={22}
            size={9.5}
            weight={600}
            anchor="middle"
            tone="muted"
          >
            {d}
          </Label>
          {i > 0 ? (
            <line
              x1={x0 + i * col}
              y1={top}
              x2={x0 + i * col}
              y2={H - 10}
              className="stroke-slate-100"
            />
          ) : null}
        </g>
      ))}
      <line x1={x0} y1={top} x2={x0 + col * 5} y2={top} className="stroke-slate-200" />
      {/* The plan's cards, all day, at the top of each day. */}
      {event(0, 2, top + 6, '#12 Launch the site', 'fill-indigo-500 dark:fill-indigo-700')}
      {event(3, 3, top + 6, '#18 Press kit', 'fill-indigo-500 dark:fill-indigo-700')}
      {event(1, 1, top + 28, 'Starts: #21 Beta', 'fill-indigo-500 dark:fill-indigo-700')}
      {/* The person's own meetings, below, in another hue. */}
      <line x1={x0} y1={top + 52} x2={x0 + col * 5} y2={top + 52} className="stroke-slate-200" />
      {event(0, 0, top + 70, 'Stand-up', 'fill-emerald-500 dark:fill-emerald-700')}
      {event(2, 2, top + 96, 'Design review', 'fill-emerald-500 dark:fill-emerald-700')}
      {event(4, 4, top + 70, 'Stand-up', 'fill-emerald-500 dark:fill-emerald-700')}
    </Scene>
  );
}
