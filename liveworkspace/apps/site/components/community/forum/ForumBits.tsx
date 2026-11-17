import {
  forumCategoryLabel,
  type ForumAuthor,
  type ForumCategory,
  type ForumPostState,
} from '@liveworkspace/community';
import { CommunityAuthorBadge, communitySharedAgo } from '@liveworkspace/community-ui';
import { Chip, SOLID_BRAND_DARK_CONTROL } from '@liveworkspace/ui';
import { AnswerIcon, HiddenIcon, PendingIcon, RefusedIcon } from '../shared/icons';

// The Forum's small shared pieces (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the page"):
// the category pill, who wrote it and when, and the mark on a post only its author sees.

export function CategoryPill({ category }: { category: ForumCategory }) {
  return (
    <Chip
      height={24}
      className="bg-slate-100 px-2.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      {forumCategoryLabel(category)}
    </Chip>
  );
}

/** "Ada · 3 hours ago · edited". */
export function Byline({
  author,
  createdAt,
  editedAt,
  now,
  size = 22,
}: {
  author: ForumAuthor;
  createdAt: number;
  editedAt?: number | null;
  now: number;
  size?: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
      <CommunityAuthorBadge
        author={{ ...author, picture: null }}
        size={size}
        className="font-medium text-slate-700 dark:text-slate-200"
      />
      <span aria-hidden>·</span>
      <time dateTime={new Date(createdAt).toISOString()} className="shrink-0">
        {communitySharedAgo(createdAt, now)}
      </time>
      {editedAt ? (
        <>
          <span aria-hidden>·</span>
          <span className="shrink-0">edited</span>
        </>
      ) : null}
    </span>
  );
}

// What each state the author alone sees says, short (a badge) and in full (the note on the post).
const STATES = {
  pending: {
    badge: 'Pending',
    note: 'Pending: being checked. Only you can see it until it passes the community check.',
    Icon: PendingIcon,
    tone: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  },
  refused: {
    badge: 'Not Posted',
    note: "Didn't pass the community check, so only you can see it. Edit it to try again, or delete it.",
    Icon: RefusedIcon,
    tone: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30',
  },
  hidden: {
    badge: 'Hidden',
    note: 'Hidden after reports, so only you can see it. It can no longer be changed.',
    Icon: HiddenIcon,
    tone: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  },
} as const;

/** A short mark on a post nobody else can see yet; nothing for a listed one. */
export function StateBadge({ state }: { state: ForumPostState }) {
  if (state === 'listed') return null;
  const { badge, Icon, tone } = STATES[state];
  return (
    <Chip
      height={24}
      icon={<Icon size={12} aria-hidden />}
      className={`px-2.5 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {badge}
    </Chip>
  );
}

/** Answered on a topic, or Answer on the reply that is its answer. */
export function AnswerChip({ label }: { label: 'Answered' | 'Answer' }) {
  return (
    <Chip
      height={24}
      icon={<AnswerIcon size={12} aria-hidden />}
      className="bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
    >
      {label}
    </Chip>
  );
}

/** The full note across a post nobody else can see yet. */
export function StateNote({ state }: { state: ForumPostState }) {
  if (state === 'listed') return null;
  const { note, Icon, tone } = STATES[state];
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${tone}`}
    >
      <Icon size={15} aria-hidden className="mt-0.5 shrink-0" />
      {note}
    </p>
  );
}

const CHIP =
  'h-8 shrink-0 cursor-pointer rounded-full px-3 text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const CHIP_OFF =
  'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white';

/** A filter chip on the Forum list: solid brand when chosen. `soft` keeps a chosen chip light, for one holding an
 *  app's logo, whose colours a solid fill would drown. */
export function filterChipClass(
  active: boolean,
  extra = '',
  tone: 'solid' | 'soft' = 'solid',
): string {
  const on =
    tone === 'soft'
      ? 'bg-brand-50 ring-2 ring-inset ring-brand-600 dark:bg-brand-500/15 dark:ring-brand-400'
      : `bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL} dark:text-white`;
  return `${CHIP} ${active ? on : CHIP_OFF} ${extra}`.trim();
}
