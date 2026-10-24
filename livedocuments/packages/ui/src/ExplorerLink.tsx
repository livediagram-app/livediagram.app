'use client';

import { lucideFolder } from '@livedocuments/icons/lucide';

import { buttonClassName } from './Button';
import { EXPLORER_HOME_HREF, useSignedInHint } from './HeaderPrimaryCta';
import { lucideGlyph } from './icons/lucide-glyph';

const FolderIcon = lucideGlyph(lucideFolder, 16);

// The site header's Explorer link (docs/specs/019-marketing/marketing-site.md "Header"): a quiet ghost
// link to Explorer Home, so anyone can find their things, a new visitor and a guest included. On a
// marketing page (`always`) it shows for everyone, last of the bar's three links; elsewhere, signed in,
// the primary is already Open Explorer (HeaderPrimaryCta), so this steps aside. Below `compactBelow`
// (`sm`, or `lg` in the marketing bar) it is the folder alone, its name kept in the aria-label.
const COMPACT = {
  sm: { box: 'max-sm:px-3', label: 'max-sm:hidden' },
  lg: { box: 'max-lg:px-3 max-[359px]:!px-2.5', label: 'max-lg:hidden' },
} as const;

export function ExplorerLink({
  always = false,
  compactBelow = 'sm',
}: {
  always?: boolean;
  compactBelow?: keyof typeof COMPACT;
}) {
  const signedIn = useSignedInHint();
  if (signedIn && !always) return null;
  const compact = COMPACT[compactBelow];
  return (
    <a
      href={EXPLORER_HOME_HREF}
      aria-label="Explorer"
      className={buttonClassName({
        variant: 'ghost',
        size: 'md',
        // Compact, the folder alone in a 40px square, so the bar fits a phone (SiteHeader).
        className: `relative shrink-0 touch-target-y ${compact.box} !text-slate-600 dark:!text-slate-300`,
      })}
    >
      <FolderIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
      <span className={`text-optical-line ${compact.label}`}>Explorer</span>
    </a>
  );
}
