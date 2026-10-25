import { buttonClassName, ButtonContent } from '@liveworkspace/ui';
import type { HelpSite } from '../site';
import { Breadcrumb } from './Breadcrumb';
import { ExternalLinkIcon } from './chrome-icons';

// The Contact route (docs/specs/018-help/help-pages.md "Contact"): the contact form, a way to report a problem,
// and a pointer back into the guides. An open-source product's way to report is its issue tracker; any other
// product's is the private vulnerability report.

export function contactMetadata(site: HelpSite) {
  return site.helpMetadata({
    title: 'Contact',
    description: `Get in touch with the ${site.facts.siteName} team, report a bug, or request a feature.`,
    path: '/help/contact/',
  });
}

const ExternalIcon = <ExternalLinkIcon />;

const CARD =
  'rounded-xl border border-slate-200 bg-white p-5 transition-all duration-micro hover:border-slate-300 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600';
const HEADING = 'mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100';
const BODY = 'mb-4 leading-relaxed text-slate-600 dark:text-slate-300';
const LINK =
  'text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200';

export function ContactPage({ site, issuesUrl }: { site: HelpSite; issuesUrl?: string }) {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Contact' }]} helpUrl={site.facts.helpUrl} />
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl dark:text-slate-100">
          Contact
        </h1>
        <p className="mb-8 text-base leading-relaxed text-slate-600 md:text-lg dark:text-slate-300">
          We are happy to help. Pick whichever route fits.
        </p>

        <div className="space-y-4">
          <div className={CARD}>
            <h2 className={HEADING}>Message Us</h2>
            <p className={BODY}>
              Questions, feedback, or trouble with a feature? Send the team a message through the
              contact form and we will get back to you.
            </p>
            <a
              href={site.facts.contactFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({ size: 'cta-sm' })}
            >
              <ButtonContent>
                Open the contact form
                {ExternalIcon}
              </ButtonContent>
            </a>
          </div>

          {issuesUrl ? (
            <div className={CARD}>
              <h2 className={HEADING}>Report a Bug or Request a Feature</h2>
              <p className={BODY}>
                {site.facts.siteName} is open source. Open an issue on GitHub to report a bug,
                suggest an idea, or follow along with development.
              </p>
              <a
                href={issuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({ variant: 'secondary', size: 'cta-sm' })}
              >
                <ButtonContent>
                  Open an issue on GitHub
                  {ExternalIcon}
                </ButtonContent>
              </a>
            </div>
          ) : (
            <div className={CARD}>
              <h2 className={HEADING}>Report a Security Issue</h2>
              <p className={BODY}>
                Found a vulnerability? Please tell us privately by email so we can fix it before
                anyone else finds it.
              </p>
              <a
                href="/help/policies/report-a-vulnerability/"
                className={buttonClassName({ variant: 'secondary', size: 'cta-sm' })}
              >
                <ButtonContent>How to report a vulnerability</ButtonContent>
              </a>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className={HEADING}>Browse the Guides</h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              Many questions are already answered here. Try the search on the{' '}
              <a href="/help/" className={LINK}>
                help home
              </a>
              , or browse the{' '}
              <a href="/help/features/" className={LINK}>
                feature guides
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
