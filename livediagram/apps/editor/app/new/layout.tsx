import type { ReactNode } from 'react';
import { trustedHtml } from '@livediagram/ui';
import { EDITOR_VIEWPORT } from '@liveworkspace/workbench/lib/page-viewport';
import {
  BYPASS_GUARD_SCRIPT,
  BYPASS_GUARD_STYLE,
  EARLY_MODE_SCRIPT,
  EARLY_MODE_STYLE,
} from './early-mode-choice';

// /new opens the editor in place once its document is made, so the page is pinned at 1 like the editor's own
// route (lib/page-viewport.ts). The page itself is a client component, which can't export a viewport.
export const viewport = EDITOR_VIEWPORT;

// The two pre-hydration scripts (and their styles) live here, in a server layout, not in the client page: React
// warns about a script tag rendered by a client component. They still sit ahead of the page's markup, so they run
// as the HTML parses, before the wizard paints (early-mode-choice.ts).
export default function NewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: trustedHtml(BYPASS_GUARD_SCRIPT) }} />
      <style>{BYPASS_GUARD_STYLE}</style>
      <script dangerouslySetInnerHTML={{ __html: trustedHtml(EARLY_MODE_SCRIPT) }} />
      <style>{EARLY_MODE_STYLE}</style>
      {children}
    </>
  );
}
