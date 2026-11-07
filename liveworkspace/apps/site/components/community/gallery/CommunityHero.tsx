import { buttonClassName, ButtonContent } from '@liveworkspace/ui';
import { useCommunitySite } from '../client';
import { capitalise } from '../lib/format';
import { SparklesIcon } from '../shared/icons';

// The gallery's welcome (liveworkspace/docs/specs/007-community/community.md "The gallery"), in the scope's words: the
// app's, or every app's for All Apps. Rendered with the static shell, so the heading is the page's LCP and paints with
// it. The words that name the app hold their space unseen until the page knows whose address it is on, so a visitor
// to an app's Community never sees liveworkspace's words flash first.
export function CommunityHero() {
  const { words, links, HelpLink, ready } = useCommunitySite();
  const named = ready ? '' : 'invisible';
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p
          className={`mb-3 inline-flex items-center gap-1.5 ${named} text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400`}
        >
          <SparklesIcon size={14} aria-hidden />
          Made With {words.product}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Community
        </h1>
        <p className={`mt-3 ${named} text-lg leading-relaxed text-slate-600 dark:text-slate-300`}>
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
