'use client';

import { lucideFolder } from '@livedocuments/icons/lucide';

import { buttonClassName } from './Button';
import { EXPLORER_HOME_HREF, useSignedInHint } from './HeaderPrimaryCta';
import { lucideGlyph } from './icons/lucide-glyph';

const FolderIcon = lucideGlyph(lucideFolder, 16);

// The site header's Explorer link (docs/specs/019-marketing/marketing-site.md "Header"): a quiet ghost
// link to Explorer Home, so anyone can find their things, a new visitor and a guest included. Signed
// in, the primary is already Open Explorer (HeaderPrimaryCta), so this steps aside. Below `sm` it is
// the folder alone, its name kept in the aria-label.
export function ExplorerLink() {
  const signedIn = useSignedInHint();
  if (signedIn) return null;
  return (
    <a
      href={EXPLORER_HOME_HREF}
      aria-label="Explorer"
      className={buttonClassName({
        variant: 'ghost',
        size: 'md',
        className: 'relative shrink-0 touch-target-y !text-slate-600 dark:!text-slate-300',
      })}
    >
      <FolderIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
      <span className="text-optical-line max-sm:hidden">Explorer</span>
    </a>
  );
}
