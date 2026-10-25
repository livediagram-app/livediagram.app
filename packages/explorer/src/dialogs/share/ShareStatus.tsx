// The Share dialog's status line: who can open the item right now, in one phrase, after a small glyph in its tone
// (never a coloured dot): a slate lock while only the owner can get in, an emerald link once a pass is live (the
// team's glyph for an item in a team's library), and a pink globe while the host says it is public (livediagram's
// canvas listed in the Community), the widest exposure, which wins. livediagram's ShareStatus from before the
// Explorer split, with the glyph in place of its dot.

import { LinkIcon, LockIcon, TeamIcon } from '../../ui/icons';
import { GlobeGlyph } from './glyphs';

export function shareStatusText({
  passes,
  password,
  team,
  word,
  publicNote = null,
}: {
  passes: number;
  password: boolean;
  team: boolean;
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
      ? `Shared: every member of the team can open this ${word}, and anyone holding ${holders} can get in${withPassword}.`
      : `Team: every member of the team can open this ${word}.`;
  }
  return passes > 0
    ? `Shared: anyone holding ${holders} can get in${withPassword}.`
    : `Private: only you can open this ${word}.`;
}

export function ShareStatus(props: {
  passes: number;
  password: boolean;
  team: boolean;
  word: string;
  publicNote?: string | null;
}) {
  const isPublic = Boolean(props.publicNote);
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
    <span
      className="inline-flex items-center gap-2"
      role="status"
      data-share-status={isPublic ? 'public' : ''}
    >
      <span aria-hidden className={`flex shrink-0 ${tone}`}>
        {glyph}
      </span>
      {shareStatusText(props)}
    </span>
  );
}
