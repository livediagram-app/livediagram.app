import { useCommunitySite } from '../client';
import { ForumIcon } from '../shared/icons';

// The Forum's welcome (liveworkspace/docs/specs/007-community/community.md "The Forum"): its heading, Community Forum (the
// gallery's reads Community Gallery), with a line saying what the Forum is for. One forum for every app, so its words name
// none; the help link reads the page's app's help centre.
export function ForumHero({
  action,
  heading: Heading = 'h1',
}: {
  action: React.ReactNode;
  /** h1 on the list; a plain line on a topic, whose title is the page's h1. */
  heading?: 'h1' | 'p';
}) {
  const { HelpLink } = useCommunitySite();
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
          <ForumIcon size={14} aria-hidden />
          Tips, Ideas and Conversations
        </p>
        <Heading className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Community Forum
        </Heading>
        <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Share tips, show what you've made, suggest ideas, report bugs and talk with other people
          using the apps. One forum for every app.{' '}
          <HelpLink article="finding" variant="inline">
            How the Forum Works
          </HelpLink>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">{action}</div>
    </div>
  );
}
