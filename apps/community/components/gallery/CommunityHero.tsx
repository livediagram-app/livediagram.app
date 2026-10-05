import { buttonClassName, ButtonContent, CommunityHelpLink } from '@livediagram/ui';
import { SHARE_YOUR_OWN_HREF } from '@/lib/links';
import { SparklesIcon } from '../shared/icons';

// The gallery's welcome (docs/specs/025-community/community.md "Gallery"; blueprint §9 final copy).
// Static, so the heading is the page's LCP and paints with the shell (blueprint §11).
export function CommunityHero() {
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
          <SparklesIcon size={14} aria-hidden />
          Made With livediagram
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Community
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Documents people are proud of. Find inspiration, then make it your own.{' '}
          <CommunityHelpLink article="finding" variant="inline">
            How the Community Works
          </CommunityHelpLink>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap-reverse items-center gap-3">
        <CommunityHelpLink article="sharing" variant="button">
          How Sharing Works
        </CommunityHelpLink>
        <a
          href={SHARE_YOUR_OWN_HREF}
          className={buttonClassName({ size: 'cta', className: 'shadow-sm' })}
        >
          <ButtonContent>Share Your Own</ButtonContent>
        </a>
      </div>
    </div>
  );
}
