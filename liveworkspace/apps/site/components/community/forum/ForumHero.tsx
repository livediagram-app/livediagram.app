import { useCommunitySite } from '../client';
import { ForumIcon } from '../shared/icons';

// The Forum's welcome (liveworkspace/docs/specs/007-community/community.md "The Forum"): the Community's heading, the
// same on the gallery's tab, with a line saying what the Forum is for. One forum for every app, so its words name
// none; the help link reads the page's app's help centre.
export function ForumHero({ action }: { action: React.ReactNode }) {
  const { HelpLink } = useCommunitySite();
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
          <ForumIcon size={14} aria-hidden />
          Questions and Answers
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Community
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Ask how to do something, share a tip, or help someone else. One forum for every app.{' '}
          <HelpLink article="finding" variant="inline">
            How the Forum Works
          </HelpLink>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">{action}</div>
    </div>
  );
}
