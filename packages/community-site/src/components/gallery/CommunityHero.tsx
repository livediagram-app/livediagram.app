import { buttonClassName, ButtonContent } from '@liveworkspace/ui';
import { useCommunitySite } from '../../client';
import { capitalise } from '../../lib/format';
import { SparklesIcon } from '../shared/icons';

// The gallery's welcome (livediagram/docs/specs/025-community/community.md "Gallery"), in the app's words. Rendered with the
// static shell, so the heading is the page's LCP and paints with it.
export function CommunityHero() {
  const { words, links, HelpLink } = useCommunitySite();
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
          <SparklesIcon size={14} aria-hidden />
          Made With {words.product}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Community
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {capitalise(words.nouns)} people are proud of. Find inspiration, then make it your own.{' '}
          <HelpLink article="finding" variant="inline">
            How the Community Works
          </HelpLink>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap-reverse items-center gap-3">
        <HelpLink article="sharing" variant="button">
          How Sharing Works
        </HelpLink>
        <a
          href={links.shareYourOwn}
          className={buttonClassName({ size: 'cta', className: 'shadow-sm' })}
        >
          <ButtonContent>Share Your Own</ButtonContent>
        </a>
      </div>
    </div>
  );
}
