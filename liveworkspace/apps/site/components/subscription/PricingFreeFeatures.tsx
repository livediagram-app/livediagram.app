import { FaqItem } from '@liveworkspace/marketing-site/components/faq/FaqItem';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

// Under the comparison (liveworkspace/docs/specs/019-subscription/subscription.md "The pricing page"): whatever the
// table does not list is free on every tier, with a few examples behind a closed accordion. Examples, never the whole
// list: the table is the one place limits are written.

const CheckIcon = lucideGlyph(lucideCheck, 16);

const EXAMPLES = [
  'Unlimited documents in every app',
  'Working together live, with Editor, Participant and Viewer roles',
  'Every template in every app',
  'Import and export, in every format an app offers',
  'Offline, on your own device',
  'Google Drive, to open and save files',
  'Comments and threads',
  'The MCP server and CLI, for your AI assistant and scripts',
  'Sharing to the Community',
  'Publish to the Web',
] as const;

export function PricingFreeFeatures() {
  return (
    <section aria-labelledby="pricing-free" className="mt-16 sm:mt-20" data-pricing-free="">
      <h2
        id="pricing-free"
        className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100"
      >
        Everything Else Is Completely Free
      </h2>
      <p className="mt-2 max-w-2xl text-pretty text-slate-600 dark:text-slate-300">
        Anything not listed above is completely free for everyone, on every plan, with no limit to
        watch.
      </p>
      <div className="mt-6">
        <FaqItem q="See Some Examples">
          <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {EXAMPLES.map((example) => (
              <li key={example} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
                  <CheckIcon aria-hidden />
                </span>
                {example}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">And much more besides.</p>
        </FaqItem>
      </div>
    </section>
  );
}
