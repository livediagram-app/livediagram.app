// The Share dialog's status line: who can open the item right now, in one phrase, after a small glyph in its tone
// (never a coloured dot): a slate lock while only the owner can get in, an emerald link once a pass is live (the
// team's glyph for an item in a team's library), and a pink globe while the host says it is public (livediagram's
// canvas listed in the Community), the widest exposure, which wins. livediagram's ShareStatus from before the
// Explorer split, with the glyph in place of its dot.

import type { ShareSignInRule } from '@liveworkspace/index-client';
import { LinkIcon, LockIcon, TeamIcon } from '../../ui/icons';
import { GlobeGlyph } from './glyphs';

// Who a pass admits under the sign-in rule: anyone, anyone signed in, or accounts at the domains.
function holdersOf(signIn: ShareSignInRule | undefined): string {
  if (!signIn?.requireAccount) return 'anyone';
  if (signIn.domains.length === 0) return 'anyone signed in';
  const [first, ...rest] = signIn.domains;
  return rest.length === 0 ? `anyone at ${first}` : `anyone at ${first} or ${rest.length} more`;
}

export function shareStatusText({
  passes,
  password,
  team,
  word,
  publicNote = null,
  signIn,
}: {
  passes: number;
  password: boolean;
  team: boolean;
  // Who may open the passes (the sign-in rule); off when absent.
  signIn?: ShareSignInRule;
  // The item's kind, lower case ("plan").
  word: string;
  // Where the item is public, in the host's words ("in the Community, where anyone can find it, ..."); null when
  // it is not.
  publicNote?: string | null;
}): string {
  if (publicNote) return `Public: ${publicNote}`;
  const holders = passes === 1 ? 'the pass' : `one of the ${passes} passes`;
  const withPassword = password ? ', with the password' : '';
  if (team) {
    return passes > 0
      ? `Shared: every member of the team can open this ${word}, and ${holdersOf(signIn)} holding ${holders} can get in${withPassword}.`
      : `Team: every member of the team can open this ${word}.`;
  }
  return passes > 0
    ? `Shared: ${holdersOf(signIn)} holding ${holders} can get in${withPassword}.`
    : `Private: only you can open this ${word}.`;
}

/**
 * The same in a few words, for the one line under the hero header's title (dialog-hero-header.md: one line, never
 * wrapped): the sentence above is the line's hint and what a screen reader hears.
 */
export function shareStatusShort({
  passes,
  password,
  team,
  publicNote = null,
  signIn,
}: {
  passes: number;
  password: boolean;
  team: boolean;
  publicNote?: string | null;
  signIn?: ShareSignInRule;
}): string {
  if (publicNote) return `Public: ${publicNote}`;
  const count = `${passes} ${passes === 1 ? 'pass' : 'passes'}`;
  const rule = !signIn?.requireAccount
    ? ''
    : signIn.domains.length > 0
      ? `, ${signIn.domains.length > 1 ? `${signIn.domains.length} domains` : signIn.domains[0]} only`
      : ', sign-in on';
  const withPassword = `${password ? ', password on' : ''}${rule}`;
  if (team)
    return passes > 0 ? `Team and ${count}${withPassword}` : 'Team: every member can open it';
  return passes > 0 ? `Shared: ${count} live${withPassword}` : 'Private: only you can open it';
}

export function ShareStatus(props: {
  passes: number;
  password: boolean;
  team: boolean;
  word: string;
  publicNote?: string | null;
  signIn?: ShareSignInRule;
}) {
  const isPublic = Boolean(props.publicNote);
  const full = shareStatusText(props);
  const short = shareStatusShort(props);
  const glyph = isPublic ? (
    <GlobeGlyph />
  ) : props.team ? (
    <TeamIcon size={12} />
  ) : props.passes > 0 ? (
    <LinkIcon size={12} />
  ) : (
    <LockIcon size={12} />
  );
  const tone = isPublic
    ? 'text-pink-600 dark:text-pink-400'
    : props.passes > 0 || props.team
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-400 dark:text-slate-500';
  return (
    // One line in the hero header's subtitle: the short words, truncating after the glyph if they must.
    <span
      className="flex min-w-0 items-center gap-2"
      role="status"
      data-share-status={isPublic ? 'public' : ''}
    >
      <span aria-hidden className={`flex shrink-0 ${tone}`}>
        {glyph}
      </span>
      {short === full ? (
        <span className="truncate">{full}</span>
      ) : (
        <>
          <span aria-hidden className="truncate">
            {short}
          </span>
          <span className="sr-only">{full}</span>
        </>
      )}
    </span>
  );
}
