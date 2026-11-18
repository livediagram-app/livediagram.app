'use client';

import type { ReactNode } from 'react';
import { Brand, type BrandApp } from '@liveworkspace/brand';
import { safeInlinePadding, safeInset } from '@liveworkspace/ui';

// The autosave's sync state. No header pill shows it any more: the failure states each raise a toast (each editor's
// editor-persistence.ts), so silent failures (offline, API down, wrong env var pointing at unreachable host) never
// look identical to a successful save.
// 'error' is a save that FAILED and may well work next time (offline, a blip, a 5xx). 'forbidden' is a save the
// server refused outright (the share link was revoked, we were removed from the team), which no amount of retrying
// fixes, so it gets its own state and its own wording rather than telling the user to check a connection that is
// fine. 'unauthenticated' is a save the server could not tie to the signed-in account (a 401, or no session token to
// send); it is retried, since the session can come back. 'tooLarge' is a tab over the server's row cap (a 413): only
// an edit that shrinks it can save, so it is not retried on a timer.
export type SaveStatus =
  'idle' | 'saving' | 'saved' | 'error' | 'unauthenticated' | 'forbidden' | 'tooLarge';

export type EditorHeaderProps = {
  // Which app's logo leads the bar, and where it goes: the Explorer.
  app: BrandApp;
  logoHref: string;
  // The account control at the far right (the editor's AuthControls: Sign in, or the account menu).
  account: ReactNode;
};

// The bar over the pages that stand in for an item (docs/specs/007-editor/editor-app.md "Header actions"): the
// loading, missing and failed-to-create screens. The open editor has no header bar: its logo, menu and
// actions live in the corner cards (ToolbarExplorerButton, EditorCornerActions), and the item is named and renamed in
// the Explorer panel. So this bar holds only the app's logo, which goes to the Explorer, and the account control. One
// copy for every editor; each binds it in its components/chrome/EditorHeader.tsx with its app and AuthControls.
export function EditorHeader({ app, logoHref, account }: EditorHeaderProps) {
  return (
    // `relative z-[var(--z-modal)]` puts the header into its own stacking context above the page that follows it, so
    // the account control's menu (which overflows the bar downward) is never hidden behind it.
    <header
      data-region="header"
      // The app's own colours, whatever the tab's style (docs/specs/011-theme/canvas-and-theme-dialog.md).
      data-app-chrome
      // Below the status bar / notch and past a landscape notch's sides (lib/safe-area).
      style={{
        height: `calc(3.5rem + ${safeInset('top')})`,
        paddingTop: safeInset('top'),
        ...safeInlinePadding('1rem'),
      }}
      className="relative z-[var(--z-modal)] flex shrink-0 items-center justify-between gap-2 border-y border-slate-200 bg-white sm:gap-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      {/* A plain logo, with no site switcher: in an editor it stays out of the way
          (liveworkspace/docs/specs/010-site/site-switcher.md "Where it shows"). */}
      <Brand
        app={app}
        href={logoHref}
        size="md"
        wordmarkClassName="hidden sm:inline"
        className="relative touch-target"
      />
      {/* Flush to the top, bottom and right of the bar (the -mr-4 cancels the header's right padding). */}
      <div className="-mr-4 flex shrink-0 items-stretch self-stretch">{account}</div>
    </header>
  );
}
