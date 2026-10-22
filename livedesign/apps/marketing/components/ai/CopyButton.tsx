'use client';

import { lucideCheck, lucideCopy } from '@livedesign/icons/lucide';
import { lucideGlyph, useCopiedFlash } from '@livedesign/ui';

const CopyIcon = lucideGlyph(lucideCopy, 14);
const CheckIcon = lucideGlyph(lucideCheck, 14);

// The Build with AI page's copy button (docs/specs/019-marketing/build-with-ai.md "Behaviour"): writes `text`,
// flashes "Copied" for two seconds and announces it politely. A blocked clipboard leaves it as it was (the
// text beside it is always selectable). `tone="dark"` sits on the dark code panels, `size="xs"` in their header.
// Its name starts with the words it shows (WCAG 2.5.3, so "click Copy prompt" works by voice) and stays put; the
// "Copied" announcement is a live region beside the button, as a button's own children are not read as a region.
export function CopyButton({
  text,
  label = 'Copy',
  what,
  tone = 'light',
  size = 'sm',
  className = '',
}: {
  text: string;
  label?: string;
  /** What is copied, after the label in the accessible name ("Copy the address", "Copy prompt: Build a deck"). */
  what: string;
  tone?: 'light' | 'dark' | 'brand';
  size?: 'sm' | 'xs';
  className?: string;
}) {
  const { copied, flash } = useCopiedFlash(2000);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      flash();
    } catch {
      // Clipboard blocked (insecure context / permissions): the text stays selectable.
    }
  }

  const tones = {
    light:
      'border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-300',
    dark: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white',
    brand:
      'bg-brand-700 text-white shadow-sm hover:bg-brand-800 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400',
  } as const;

  const sizes = { sm: 'py-1.5 text-sm', xs: 'py-1 text-xs' } as const;

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label === 'Copy' ? `Copy ${what}` : `${label}: ${what}`}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 touch-target-y relative ${sizes[size]} ${tones[tone]} ${className}`}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        <span className="text-optical-line">{copied ? 'Copied' : label}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `Copied ${what}` : ''}
      </span>
    </>
  );
}
