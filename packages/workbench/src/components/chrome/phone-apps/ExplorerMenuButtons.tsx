'use client';

// The menu card's buttons, one copy for every editor's ToolbarExplorerButton
// (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md "The rule"). From the phone breakpoint up: the hamburger,
// which toggles the Explorer panel and wears the Inbox's count. On a phone: the app's logo in the hamburger's place,
// doing what it did (still named Explorer), and Apps, which opens the Apps drawer with what the corner card held.
import { lazy, Suspense, useState, type Ref } from 'react';
import { BrandMark, type BrandApp } from '@liveworkspace/brand';
import { Glyph } from '@liveworkspace/ui';
import { inboxButtonLabel } from '@liveworkspace/explorer/inbox-notices';
import { workbench } from '../../../bindings';
import { useIsMobileViewport } from '../../../hooks/ui/useIsMobileViewport';
import type { EditorInbox } from '../useEditorInbox';

// The drawer's code loads on the first press of Apps (about 3 KB gzipped, measured), not with every editor's first
// paint: a desktop never opens it. The press starts the load on pointer-down, so it is in by the click.
const loadDrawer = () => import('./AppsDrawer');
const AppsDrawer = lazy(() => loadDrawer().then((m) => ({ default: m.AppsDrawer })));

const MENU_BTN =
  'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition';
const MENU_OPEN = 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';
const MENU_REST = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';

export type ExplorerMenuButtonsProps = {
  app: BrandApp;
  // The Explorer panel is open (the button's pressed look and `aria-expanded`).
  open: boolean;
  // Given the button itself, which the panel's popover anchors to.
  onToggle: (button: HTMLElement) => void;
  // The button that opens the panel: the Rename command opens it from there (useRenameCurrentRequest).
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  // The open item, for the drawer's Explorer tile.
  itemId: string | null;
  // The app's Inbox (useEditorInbox); absent where it keeps none (livehuddle).
  inbox?: EditorInbox | undefined;
};

export function ExplorerMenuButtons({
  app,
  open,
  onToggle,
  buttonRef,
  itemId,
  inbox,
}: ExplorerMenuButtonsProps) {
  const phone = useIsMobileViewport();
  const toggle = (button: HTMLElement) => {
    if (!open) workbench.track('UI', 'Opened', 'ToolbarExplorer');
    onToggle(button);
  };
  if (!phone) {
    return (
      <button
        ref={buttonRef}
        type="button"
        aria-label={inbox ? inbox.label('Explorer') : 'Explorer'}
        aria-expanded={open}
        onClick={(e) => toggle(e.currentTarget)}
        className={`${MENU_BTN} ${open ? MENU_OPEN : MENU_REST}`}
      >
        <Glyph size={18} units={20} strokeLinejoin="miter">
          <path d="M4 6h12M4 10h12M4 14h12" />
        </Glyph>
        {inbox?.badge}
      </button>
    );
  }
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Explorer"
        aria-expanded={open}
        data-phone-logo=""
        onClick={(e) => toggle(e.currentTarget)}
        className={`${MENU_BTN} ${open ? MENU_OPEN : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
      >
        <BrandMark app={app} className="size-7" />
      </button>
      <AppsButton app={app} itemId={itemId} inbox={inbox} />
    </>
  );
}

// Apps: a 3 x 3 of dots, a red dot while the Inbox has unread items, and the drawer while open.
function AppsButton({
  app,
  itemId,
  inbox,
}: {
  app: BrandApp;
  itemId: string | null;
  inbox: EditorInbox | undefined;
}) {
  const [open, setOpen] = useState(false);
  const count = inbox?.count;
  return (
    <>
      <button
        type="button"
        aria-label={inboxButtonLabel('Apps', count)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-phone-apps-button=""
        onPointerDown={() => void loadDrawer()}
        onClick={() => {
          if (!open) workbench.track('UI', 'Opened', 'PhoneApps');
          setOpen(!open);
        }}
        className={`${MENU_BTN} ${
          open
            ? 'bg-brand-700 text-white dark:bg-brand-600'
            : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25'
        }`}
      >
        <Glyph size={20} units={24} filled>
          {[5, 12, 19].map((y) =>
            [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />),
          )}
        </Glyph>
        {count ? (
          <span
            aria-hidden="true"
            data-unread-dot=""
            className="pointer-events-none absolute right-[22%] top-[22%] size-2 rounded-full bg-red-600 ring-2 ring-brand-50 dark:ring-slate-900"
          />
        ) : null}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <AppsDrawer
            app={app}
            itemId={itemId}
            inboxCount={count}
            hasInbox={!!inbox}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
