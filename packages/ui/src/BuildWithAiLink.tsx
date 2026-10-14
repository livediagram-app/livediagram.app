import { lucideSparkles } from '@livediagram/icons/lucide';

import { ButtonContent, buttonClassName } from './Button';
import { lucideGlyph } from './icons/lucide-glyph';

const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The site header's Build with AI link (docs/specs/019-marketing/build-with-ai.md "Entry points"): a quiet ghost
// link to /ai, left of Start Blank, so the CTA pair stays the loudest thing in the bar. Desktop only (lg+): below
// that the bar is full with Brand, the apps menu and the pair. `current` marks it on /ai itself.
export function BuildWithAiLink({ current = false }: { current?: boolean }) {
  return (
    <a
      href="/ai"
      aria-current={current ? 'page' : undefined}
      className={buttonClassName({
        variant: 'ghost',
        size: 'md',
        className: `relative shrink-0 touch-target-y max-lg:hidden ${
          current
            ? 'bg-brand-50 text-brand-700 hover:bg-brand-50 hover:text-brand-800 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-200'
            : 'text-slate-600 dark:text-slate-300'
        }`,
      })}
    >
      <SparklesIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
      <ButtonContent>Build with AI</ButtonContent>
    </a>
  );
}
