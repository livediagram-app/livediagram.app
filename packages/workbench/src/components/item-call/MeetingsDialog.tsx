'use client';

// The item's Meetings, from Tools (liveworkspace/docs/specs/004-index/item-calls.md "Meetings"): each call about it,
// newest first, with when it was, who came, and its summary page and plan where the reader can open them. The live
// one wears Join. Loaded on its first open; it reads nothing of its own (the store already holds the item's calls).
import { useId } from 'react';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { meetingHeroArt } from '@liveworkspace/ui/dialog-hero-art/meeting';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideBookOpen, lucideSquareKanban, lucideUsers } from '@liveworkspace/icons/lucide';
import type { ItemMeeting } from '@liveworkspace/index-client';
import { workbench } from '../../bindings';
import { Dialog } from '../dialogs/Dialog';
import { useItemCalls } from './item-call-store';
import { joinCall } from './ItemCallButton';

const PeopleGlyph = lucideGlyph(lucideUsers, 13);
const PageGlyph = lucideGlyph(lucideBookOpen, 13);
const PlanGlyph = lucideGlyph(lucideSquareKanban, 13);

const MINUTE = 60_000;

/** "Today, 14:05", "Yesterday, 09:30" or "Mon 17 Nov, 16:00". */
export function meetingWhen(at: number, now = Date.now()): string {
  const day = (t: number) => new Date(t).toDateString();
  const time = new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (day(at) === day(now)) return `Today, ${time}`;
  if (day(at) === day(now - 86_400_000)) return `Yesterday, ${time}`;
  const date = new Date(at).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${date}, ${time}`;
}

/** "12 min", "1 hr 5 min"; null while it runs or when nobody came. */
export function meetingLength(m: Pick<ItemMeeting, 'startedAt' | 'endedAt'>): string | null {
  if (m.endedAt === null) return null;
  const mins = Math.max(1, Math.round((m.endedAt - m.startedAt) / MINUTE));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hrs} hr ${rest} min` : `${hrs} hr`;
}

/** "Ada, Ben and 3 more", or "Nobody joined". */
export function meetingWho(names: readonly string[]): string {
  if (names.length === 0) return 'Nobody joined';
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more} more`;
  if (shown.length === 1) return shown[0]!;
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

const LINK =
  'inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/50';

function MeetingRow({ meeting, onJoin }: { meeting: ItemMeeting; onJoin: () => void }) {
  const length = meetingLength(meeting);
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          {meetingWhen(meeting.startedAt)}
          {meeting.live ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Live
            </span>
          ) : length ? (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{length}</span>
          ) : null}
          {meeting.you ? (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Started by you
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-600 dark:text-slate-300">
          <PeopleGlyph />
          <span className="truncate">{meetingWho(meeting.names)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {meeting.summary ? (
          <a
            href={meeting.summary.link}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
            onClick={() => workbench.track('UI', 'Opened', 'MeetingSummary')}
          >
            <PageGlyph />
            Summary
          </a>
        ) : null}
        {meeting.plan ? (
          <a href={meeting.plan.link} target="_blank" rel="noopener noreferrer" className={LINK}>
            <PlanGlyph />
            <span className="max-w-32 truncate">{meeting.plan.title || 'Plan'}</span>
          </a>
        ) : null}
        {meeting.live ? (
          <button
            type="button"
            onClick={onJoin}
            className="cursor-pointer rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            Join
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function MeetingsDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const { source, read } = useItemCalls();
  const meetings = read?.meetings ?? [];
  return (
    <Dialog open onClose={onClose} ariaLabel="Meetings" size="lg" className="max-h-[85vh]">
      <HeroDialogHeader
        art={meetingHeroArt}
        titleId={titleId}
        title="Meetings"
        subtitle={`Calls about ${source?.title || 'this item'}, with their summaries and actions.`}
        onClose={onClose}
      />
      <div className="min-h-40 flex-1 overflow-y-auto">
        {read === null ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading meetings…
          </p>
        ) : meetings.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              No meetings yet
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {source?.canStart
                ? 'Press Call in the top corner to hold one. It opens in a new tab.'
                : 'Calls about it show here, with their summaries.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {meetings.map((m) => (
              <MeetingRow
                key={m.id}
                meeting={m}
                onJoin={() => {
                  if (!source) return;
                  workbench.track('UI', 'Opened', 'ItemCall');
                  joinCall(source, m);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
