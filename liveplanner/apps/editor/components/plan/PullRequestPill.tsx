'use client';

// A linked pull request's state as a card draws it (docs/specs/026-plan/github-pull-requests.md "Pull request state on
// cards"; blueprint "Part 3" "The editor"): the state's GitHub mark in the state's colour, the short name and, for an
// open pull request whose checks reported, the checks' mark. The face draws a field holding one as a pill and the rest
// as marks beside the title's flags; the panel draws a chip in words. Each says its short name and state ("acme/web#42:
// Merged") to a screen reader and in its tooltip.
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import {
  lucideCheck,
  lucideGitMerge,
  lucideGitPullRequest,
  lucideGitPullRequestClosed,
  lucideGitPullRequestDraft,
  lucideX,
} from '@liveworkspace/icons/lucide';
import {
  pullRequestStatusLabel,
  pullRequestText,
  showsChecks,
  type CardPullRequest,
  type PullRequestChecks,
  type PullRequestRef,
  type PullRequestState,
  type PullRequestStatus,
} from '@liveplanner/items';
import { isLightColor } from '@liveplanner/project';
import { MetaPill } from './plan-card-parts';
import { chipInkOn, type PlanPalette } from './plan-palette';

// GitHub's own colours for each state and check, leaned on each card until they read (chipInkOn).
export const PULL_REQUEST_TONES: Record<PullRequestState, string> = {
  open: '#1a7f37',
  draft: '#59636e',
  merged: '#8250df',
  closed: '#cf222e',
};
export const CHECKS_TONES: Record<PullRequestChecks, string> = {
  passing: '#1a7f37',
  running: '#9a6700',
  failing: '#cf222e',
};
// On a dark card GitHub's own dark amber: the light one, leaned toward the ink, read brown on navy.
export const CHECKS_TONES_DARK: Record<PullRequestChecks, string> = {
  ...CHECKS_TONES,
  running: '#d29922',
};

/** The checks' ink on this card: its tone for the card's scheme, leaned until it reads (chipInkOn). */
export const checksInk = (checks: PullRequestChecks, palette: PlanPalette): string =>
  chipInkOn((isLightColor(palette.card) ? CHECKS_TONES : CHECKS_TONES_DARK)[checks], palette);

const MARKS: Record<PullRequestState, ReturnType<typeof lucideGlyph>> = {
  open: lucideGlyph(lucideGitPullRequest, 12),
  draft: lucideGlyph(lucideGitPullRequestDraft, 12),
  merged: lucideGlyph(lucideGitMerge, 12),
  closed: lucideGlyph(lucideGitPullRequestClosed, 12),
};
const NoStateMark = MARKS.open;
const PassingMark = lucideGlyph(lucideCheck, 11);
const FailingMark = lucideGlyph(lucideX, 11);

// The most a face shows beside the title's flags.
export const PULL_REQUEST_MARKS_MAX = 3;

const CHECKS_WORDS: Record<PullRequestChecks, string> = {
  passing: 'Checks Passing',
  running: 'Checks Running',
  failing: 'Checks Failing',
};

/**
 * "acme/web#42: Merged"; a draft whose checks reported names them too, as its marks show them ("acme/web#42: Draft,
 * Checks Failing"); the short name alone while the plan has no state for it.
 */
export function pullRequestWords(ref: PullRequestRef, status?: PullRequestStatus): string {
  if (!status) return pullRequestText(ref);
  const draftChecks =
    status.state === 'draft' && showsChecks(status) ? `, ${CHECKS_WORDS[status.checks!]}` : '';
  return `${pullRequestText(ref)}: ${pullRequestStatusLabel(status)}${draftChecks}`;
}

export function PullRequestMark({
  state,
  size = 12,
  color,
}: {
  state: PullRequestState;
  size?: number;
  color?: string;
}) {
  const Mark = MARKS[state];
  return (
    <span data-pull-request-mark={state} className="flex shrink-0" style={{ color }} aria-hidden>
      <Mark size={size} weight={2} />
    </span>
  );
}

export function ChecksMark({ checks, color }: { checks: PullRequestChecks; color?: string }) {
  return (
    <span
      data-checks-mark={checks}
      className="flex shrink-0 items-center justify-center"
      style={{ color }}
      aria-hidden
    >
      {checks === 'passing' ? (
        <PassingMark weight={2.5} />
      ) : checks === 'failing' ? (
        <FailingMark weight={2.5} />
      ) : (
        <span className="mx-[3px] size-[6px] rounded-full bg-current motion-safe:animate-pulse" />
      )}
    </span>
  );
}

/** A field's pull request on the face: its state's pill, or the short name alone with no state yet (part 1). */
export function PullRequestPill({
  pr,
  palette,
  name,
}: {
  pr: Pick<CardPullRequest, 'ref' | 'status'>;
  palette: PlanPalette;
  // The field's name, spoken first ("Pull Request: acme/web#42: Merged").
  name?: string;
}) {
  const { ref, status } = pr;
  const words = pullRequestWords(ref, status);
  const tone = status ? PULL_REQUEST_TONES[status.state] : undefined;
  return (
    <Tooltip label={words}>
      <span data-pull-request-pill={status?.state ?? 'unknown'} className="inline-flex">
        <MetaPill
          palette={palette}
          {...(tone ? { tone } : {})}
          label={name ? `${name}: ${words}` : words}
        >
          {status ? (
            <PullRequestMark state={status.state} size={11} />
          ) : (
            <span className="flex shrink-0">
              <NoStateMark size={11} />
            </span>
          )}
          <span className="max-w-[10rem] truncate">{pullRequestText(ref)}</span>
          {status && showsChecks(status) ? (
            <ChecksMark checks={status.checks!} color={checksInk(status.checks!, palette)} />
          ) : null}
        </MetaPill>
      </span>
    </Tooltip>
  );
}

/**
 * The linked pull requests no pill shows, as their states' marks beside the title's flags, up to 3. An open one (or a
 * draft) whose checks reported adds the checks' mark straight after, in the checks' colour, so a compact or phone
 * card, where no tooltip shows, still tells passing from failing from running.
 */
export function PullRequestMarks({
  prs,
  palette,
}: {
  prs: readonly CardPullRequest[];
  palette: PlanPalette;
}) {
  const shown = prs.filter((p) => p.status).slice(0, PULL_REQUEST_MARKS_MAX);
  return (
    <>
      {shown.map(({ ref, status }) => {
        const words = pullRequestWords(ref, status);
        const checks = showsChecks(status!) ? status!.checks! : undefined;
        return (
          <Tooltip key={pullRequestText(ref)} label={words}>
            <span
              data-pull-request-flag={status!.state}
              {...(checks ? { 'data-pull-request-checks': checks } : {})}
              className="mt-0.5 inline-flex shrink-0 items-center gap-px"
              role="img"
              aria-label={words}
            >
              <PullRequestMark
                state={status!.state}
                size={13}
                color={chipInkOn(PULL_REQUEST_TONES[status!.state], palette)}
              />
              {checks ? <ChecksMark checks={checks} color={checksInk(checks, palette)} /> : null}
            </span>
          </Tooltip>
        );
      })}
    </>
  );
}

// The panel's chip, on the app's own surfaces (light and dark).
const CHIP_CLASSES: Record<PullRequestState, string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  draft:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-600',
  merged:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
  closed:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
};
const CHECKS_CLASSES: Record<PullRequestChecks, string> = {
  passing: 'text-emerald-700 dark:text-emerald-300',
  running: 'text-amber-700 dark:text-amber-300',
  failing: 'text-rose-700 dark:text-rose-300',
};

/** The state in words, in the state's colour: "Merged", "Checks Failing". */
export function PullRequestChip({ status }: { status: PullRequestStatus }) {
  const checks = showsChecks(status) ? status.checks : undefined;
  return (
    <span
      data-pull-request-chip={status.state}
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-medium ring-1 ring-inset ${CHIP_CLASSES[status.state]}`}
    >
      <PullRequestMark state={status.state} size={12} />
      {/* An open one's checks follow it in their own colour. */}
      <span className="text-optical-centre">
        {status.state === 'open' ? 'Open' : pullRequestStatusLabel(status)}
      </span>
      {checks ? (
        <span className={`inline-flex items-center gap-0.5 ${CHECKS_CLASSES[checks]}`}>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <ChecksMark checks={checks} />
          <span className="text-optical-centre">
            {checks === 'passing' ? 'Passing' : checks === 'failing' ? 'Failing' : 'Running'}
          </span>
        </span>
      ) : null}
    </span>
  );
}
