'use client';

// The visual language a card's conversation and history share in its panel (docs/specs/026-plan/items.md "Where it
// shows", "History"): a person's disc on a thin rail, a value chip, a time that says when and shows the exact moment
// on hover. The Activity tab and the comment threads both draw from here, so they read as one family.

import { AutomationDisc } from '@/components/automations/automation-glyphs';
import type { ReactNode } from 'react';
import { GlyphDisc, IDENTITY_FILL, Tooltip, identityVars, lucideGlyph } from '@liveplanner/ui';
import { lucideGitPullRequest } from '@liveworkspace/icons/lucide';
import { PHASE_COLOURS } from '@liveplanner/plan-art';
import { initialsOf } from '@liveplanner/project';
import { formatRelativeTimeCompact } from '@/lib/relative-time';
import type { ActivityTone } from './activity-words';

// The rail down from a disc to the next one: a hairline centred under a disc of `size` px, placed by the row (which
// is `relative`). Absent on the last row.
export const railClass = (size: 24 | 28) =>
  `pointer-events-none absolute bottom-0 w-px bg-slate-200 dark:bg-slate-700 ${
    size === 24 ? 'left-[11.5px] top-7' : 'left-[13.5px] top-8'
  }`;

// The rail's piece in a conversation row whose 28 px disc sits a little below its top (a comment, the reply composer):
// `through` the whole row (more follows), `end` down to its disc (the last), `into` the composer's disc.
export const conversationRailClass = (kind: 'through' | 'end' | 'into') =>
  `pointer-events-none absolute left-[13.5px] top-0 w-px bg-slate-200 dark:bg-slate-700 ${
    kind === 'through' ? 'bottom-0' : kind === 'end' ? 'h-[26px]' : 'h-[22px]'
  }`;

const PullRequestGlyph = lucideGlyph(lucideGitPullRequest, 12);

// GitHub as an author: its dark disc with the pull request mark, ringed as a person's disc is.
export function GithubDisc({ size = 24 }: { size?: 24 | 28 }) {
  return (
    <span
      aria-hidden
      data-github-disc=""
      className={`relative z-[1] inline-flex shrink-0 items-center justify-center rounded-full bg-[#1f2328] text-white ring-[3px] ring-white dark:bg-slate-100 dark:text-[#1f2328] dark:ring-slate-900 ${size === 24 ? 'size-6' : 'size-7'}`}
    >
      <PullRequestGlyph size={size === 24 ? 12 : 14} weight={2} />
    </span>
  );
}

// A person's initials on their colour, on the rail.
export function TimelineDisc({
  name,
  color,
  size = 24,
  badge,
  automation = false,
  github = false,
}: {
  name: string;
  color: string;
  size?: 24 | 28;
  // Automation's bolt disc in place of initials (docs/specs/026-plan/automations.md "On cards").
  automation?: boolean;
  // GitHub's mark disc, for what GitHub did, a GitHub-triggered rule's writes included (github-pull-requests.md
  // "GitHub triggers"); it stands before Automation's bolt.
  github?: boolean;
  // A small mark on its corner (a resolved thread's check).
  badge?: ReactNode;
}) {
  return (
    <span aria-hidden className="relative z-[1] inline-flex shrink-0">
      {github ? (
        <GithubDisc size={size} />
      ) : automation ? (
        <AutomationDisc size={size} ringed />
      ) : (
        <GlyphDisc
          size={size}
          as="span"
          style={identityVars(color)}
          className={`${size === 24 ? 'text-[9px]' : 'text-[10px]'} font-semibold text-white ring-[3px] ring-white dark:ring-slate-900 ${IDENTITY_FILL}`}
        >
          {initialsOf(name)}
        </GlyphDisc>
      )}
      {badge ? <span className="absolute -bottom-1 -right-1">{badge}</span> : null}
    </span>
  );
}

const toneColour = (tone: ActivityTone) =>
  'phase' in tone ? PHASE_COLOURS[tone.phase] : tone.colour;

// A value: a quiet pill, a dot in its colour when it has one (a status's stage, a priority). The old value before an
// arrow is muted.
export function ValueChip({
  text,
  tone,
  old = false,
}: {
  text: string;
  tone?: ActivityTone | undefined;
  old?: boolean;
}) {
  return (
    <span
      data-activity-chip={old ? 'old' : 'new'}
      className={`mx-px inline-flex max-w-full items-center gap-1 rounded-md px-1.5 align-baseline text-[12px] leading-[18px] ring-1 ring-inset [overflow-wrap:anywhere] ${
        old
          ? 'bg-transparent text-slate-500 ring-slate-200 dark:text-slate-400 dark:ring-slate-700'
          : 'bg-slate-50 font-medium text-slate-800 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
      }`}
    >
      {tone ? (
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${old ? 'opacity-60' : ''}`}
          style={{ backgroundColor: toneColour(tone) }}
        />
      ) : null}
      {text}
    </span>
  );
}

// The arrow between an old value and a new one; read as "to".
export function ValueArrow() {
  return (
    <>
      <span aria-hidden className="mx-1 text-slate-400">
        →
      </span>
      <span className="sr-only"> to </span>
    </>
  );
}

// When something happened: "2h ago" (or the time of day, on an older day's row), the exact moment in a tooltip.
export function TimelineTime({
  at,
  now,
  clock = false,
  className = '',
}: {
  at: number;
  now: number;
  // The time of day instead of how long ago (a row under a day heading that is not Today).
  clock?: boolean;
  className?: string;
}) {
  const when = new Date(at);
  const exact = when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Tooltip label={exact}>
      <time
        dateTime={when.toISOString()}
        className={`whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400 ${className}`}
      >
        {clock
          ? when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          : formatRelativeTimeCompact(now - at)}
      </time>
    </Tooltip>
  );
}
