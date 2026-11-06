'use client';

// The Room Sign opened in the reader (docs/specs/009-elements/screen-and-room-sign.md "The sign's reader"): a small
// door panel. The room's name with a status chip in the sign's colour, how many are inside and for how long, who is
// inside, and the walk's two ways in, Knock and Walk In, in the dialog's action row, each with its reason when it is
// not available. Reads the pieces' store live (it re-renders when its snapshot changes, and once a minute while the
// room is in use); never on a step.
import type { ReactNode } from 'react';
import { ROOM_SIGN_TONES, inUseFor, type RoomSignStatus } from '@livehuddle/document';
import {
  Button,
  Chip,
  CompactEmptyState,
  HoverCard,
  IDENTITY_FILL,
  identityVars,
  lucideGlyph,
} from '@livehuddle/ui';
import { lucideClock, lucideFootprints, lucideUsers } from '@liveworkspace/icons/lucide';
import { initialsOf } from '@liveworkspace/model-core/names';
import {
  useKnocker,
  useMeetingLive,
  useRoomWalker,
  type SignLive,
  type SignPerson,
} from '@/lib/office/meeting-live';
import { ReaderShell } from './ReaderShell';
import { KnockGlyph } from './RoomSignView';
import { useKnockedRecently, useMinuteClock } from './room-sign-clock';

const ClockIcon = lucideGlyph(lucideClock, 15);
const UsersIcon = lucideGlyph(lucideUsers, 15);
const UsersEmptyIcon = lucideGlyph(lucideUsers, 20);
const WalkIcon = lucideGlyph(lucideFootprints, 15);

const STATUS: Record<RoomSignStatus, { word: string; chip: string }> = {
  free: {
    word: 'Free',
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/70',
  },
  'in-use': {
    word: 'In Use',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/70',
  },
  dnd: {
    word: 'Do Not Disturb',
    chip: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/70',
  },
};

// Before the canvas has worked anything out (no presence yet): a free room.
const FREE: SignLive = {
  roomId: null,
  name: 'Room',
  status: 'free',
  count: 0,
  since: null,
  selfInside: false,
  pod: false,
  people: [],
};

const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

/** "Nobody", "1 Person", "3 People". */
export function insideCount(count: number): string {
  if (count === 0) return 'Nobody';
  return count === 1 ? '1 Person' : `${count} People`;
}

/** What the footer offers, and why not when it cannot: pure, for the tests. */
export function signActions(
  live: SignLive,
  can: { knock: boolean; walk: boolean; knocked: boolean },
): {
  knock: 'hidden' | 'ready' | 'knocked' | 'unavailable';
  walk: 'ready' | 'unavailable';
  reason: string | null;
} {
  const knockable = live.status !== 'free';
  let reason: string | null = null;
  if (live.selfInside) reason = "You're inside this room";
  else if (!can.knock && !can.walk) reason = 'Walk your character to knock or walk in';
  else if (knockable && can.knocked) reason = 'You can knock again in a moment';
  else if (live.status === 'dnd') reason = 'Its door is shut';
  const knock = !knockable
    ? 'hidden'
    : live.selfInside || !can.knock
      ? 'unavailable'
      : can.knocked
        ? 'knocked'
        : 'ready';
  const walk = live.selfInside || !can.walk || live.status === 'dnd' ? 'unavailable' : 'ready';
  return { knock, walk, reason };
}

export function RoomSignReader({ elementId, onClose }: { elementId: string; onClose: () => void }) {
  const snapshot = useMeetingLive(elementId);
  const sign = snapshot && !('inside' in snapshot) ? snapshot : null;
  const live = sign ?? FREE;
  // Worked out and in no room (a snapshot not there yet reads as a free room with nothing to press).
  const noRoom = !!sign && sign.roomId === null;
  const now = useMinuteClock(live.status !== 'free');
  const knocker = useKnocker();
  const walker = useRoomWalker();
  const knocked = useKnockedRecently();
  const { roomId } = live;
  const status = STATUS[live.status];
  const kind = live.pod ? 'Office Pod' : 'Room';
  const subtitle = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip
        data-room-sign-status={live.status}
        className={`px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.chip}`}
        icon={
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{
              background: ROOM_SIGN_TONES[live.status],
              boxShadow: `0 0 0 3px ${ROOM_SIGN_TONES[live.status]}33`,
            }}
          />
        }
      >
        {noRoom ? 'No Room' : status.word}
      </Chip>
      {noRoom ? null : <span>{kind}</span>}
    </span>
  );

  if (noRoom)
    return (
      <ReaderShell
        title={live.name}
        subtitle={subtitle}
        onClose={onClose}
        widthClassName="max-w-[440px]"
        data-element-reader={elementId}
        data-room-sign-reader="none"
      >
        <CompactEmptyState
          className="px-6 py-8"
          icon={<KnockGlyph size={20} />}
          title="Not Beside a Room"
          description="An Editor moves this sign within a short step of a room's or Office Pod's floor, and it shows that room's status."
        />
      </ReaderShell>
    );

  const actions = signActions(live, {
    knock: !!knocker && !!roomId,
    walk: !!walker && !!roomId,
    knocked,
  });
  const ms = live.since === null ? 0 : now - live.since;
  const walkIn = () => {
    if (roomId) walker?.(roomId);
    onClose();
  };
  const knock = () => {
    if (roomId) knocker?.(roomId);
  };
  const walkPrimary = actions.knock === 'hidden';
  // On a phone the reason takes its own line above the buttons, so neither wraps.
  const footer = (
    <div className="flex w-full flex-wrap items-center justify-end gap-x-2 gap-y-3">
      {actions.reason ? (
        <p
          data-room-sign-reason
          className="w-full min-w-0 text-xs leading-snug text-slate-500 sm:mr-auto sm:w-auto sm:flex-1 dark:text-slate-400"
        >
          {actions.reason}
        </p>
      ) : null}
      <FooterAction
        label={`Walk into ${live.name}`}
        hint={
          actions.walk === 'ready'
            ? 'Walks your character just inside its doorway'
            : (actions.reason ?? 'Not available')
        }
        disabled={actions.walk !== 'ready'}
        variant={walkPrimary ? 'primary' : 'secondary'}
        onPress={walkIn}
        data="walk"
      >
        <WalkIcon />
        Walk In
      </FooterAction>
      {actions.knock !== 'hidden' ? (
        <FooterAction
          label={actions.knock === 'knocked' ? 'Knocked' : `Knock on ${live.name}`}
          hint={
            actions.knock === 'ready'
              ? 'Asks the people inside to let you in'
              : (actions.reason ?? 'Not available')
          }
          disabled={actions.knock !== 'ready'}
          variant="primary"
          onPress={knock}
          data="knock"
        >
          <KnockGlyph size={15} />
          {actions.knock === 'knocked' ? 'Knocked' : 'Knock'}
        </FooterAction>
      ) : null}
    </div>
  );

  return (
    <ReaderShell
      title={live.name}
      subtitle={subtitle}
      footer={footer}
      onClose={onClose}
      widthClassName="max-w-[440px]"
      data-element-reader={elementId}
      data-room-sign-reader={live.status}
    >
      <div className="flex flex-col gap-5 px-6 py-5">
        <dl className="grid grid-cols-2 gap-3">
          <Figure icon={<UsersIcon />} label="Inside" value={insideCount(live.count)} />
          <Figure
            icon={<ClockIcon />}
            label="In Use For"
            value={live.status === 'free' ? 'Not in use' : inUseFor(ms)}
            muted={live.status === 'free'}
          />
        </dl>
        {live.status === 'dnd' ? (
          <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm leading-snug text-red-800 ring-1 ring-inset ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900">
            Its door is shut while both seats are taken. A knock asks someone inside to make room.
          </p>
        ) : null}
        <section aria-label="Who's Inside" className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL}>Who&apos;s Inside</h3>
          {live.people.length === 0 ? (
            <CompactEmptyState
              className="rounded-lg border border-dashed border-slate-200 py-6 dark:border-slate-700"
              icon={<UsersEmptyIcon />}
              title="Nobody's Inside"
              description={`${live.name} is free to walk into. Everyone inside talks in the room's own call.`}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {live.people.map((p) => (
                <PersonRow key={p.id} person={p} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </ReaderShell>
  );
}

function Figure({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
      <dt className={`flex items-center gap-1.5 ${SECTION_LABEL}`}>
        {icon}
        {label}
      </dt>
      <dd
        className={`text-lg font-semibold tabular-nums leading-tight ${
          muted ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function PersonRow({ person }: { person: SignPerson }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white ${IDENTITY_FILL}`}
        style={identityVars(person.color)}
      >
        <span className="text-optical-centre">{initialsOf(person.name)}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
        {person.name}
      </span>
      {person.self ? (
        <Chip className="bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          You
        </Chip>
      ) : null}
    </li>
  );
}

// A footer button that keeps its hover card when it cannot run (aria-disabled, so it still takes the pointer and
// says why), and ignores a press then.
function FooterAction({
  label,
  hint,
  disabled,
  variant,
  onPress,
  data,
  children,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  data: 'walk' | 'knock';
  children: ReactNode;
}) {
  return (
    <HoverCard title={label} description={hint}>
      <Button
        variant={variant}
        size="md"
        aria-label={label}
        aria-disabled={disabled || undefined}
        data-room-sign-action={data}
        className="cursor-pointer whitespace-nowrap"
        onClick={disabled ? undefined : onPress}
      >
        {children}
      </Button>
    </HoverCard>
  );
}
