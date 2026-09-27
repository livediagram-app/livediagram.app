import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { helpMetadata } from '@/lib/seo';
import { buttonClassName, REPO_URL, ButtonContent } from '@livediagram/ui';
import { ExternalLinkIcon } from '@/lib/chrome-icons';

export const metadata: Metadata = helpMetadata({
  title: 'Contact',
  description: 'Get in touch with the livediagram team, report a bug, or request a feature.',
  path: '/help/contact/',
});

const ExternalIcon = <ExternalLinkIcon />;

export default function ContactPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Contact' }]} />
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl dark:text-slate-100">
          Contact
        </h1>
        <p className="mb-8 text-base leading-relaxed text-slate-600 md:text-lg dark:text-slate-300">
          We are happy to help. Pick whichever route fits.
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 transition-all duration-micro hover:border-slate-300 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Email Us
            </h2>
            <p className="mb-4 leading-relaxed text-slate-600 dark:text-slate-300">
              Questions, feedback, or trouble with a feature? Email the team and we will get back to
              you.
            </p>
            <a href="mailto:hello@livediagram.app" className={buttonClassName({ size: 'cta-sm' })}>
              <ButtonContent>hello@livediagram.app</ButtonContent>
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 transition-all duration-micro hover:border-slate-300 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Report a Bug or Request a Feature
            </h2>
            <p className="mb-4 leading-relaxed text-slate-600 dark:text-slate-300">
              livediagram is open source. Open an issue on GitHub to report a bug, suggest an idea,
              or follow along with development.
            </p>
            <a
              href={`${REPO_URL}/issues`}
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

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Browse the Guides
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              Many questions are already answered here. Try the search on the{' '}
              <a
                href="/help/"
                className="text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
              >
                help home
              </a>
              , or browse the{' '}
              <a
                href="/help/features/"
                className="text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
              >
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
