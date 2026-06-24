'use client';

// The Explorer pane header (spec/15): title + breadcrumb on the left, and on
// the right a section "?" help button, any section-specific actions slot, and
// a single Create dropdown (New diagram / New folder). Split out of views.tsx
// so that barrel holds the list/row primitives while the header chrome (and
// its private hamburger / caret icons) stands on its own.
import { useRef, useState, type ReactNode } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { HelpArticleKey } from '@/lib/help-articles';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { DiagramIcon, MenuFolderIcon, PlusIcon } from './icons';

function HamburgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}

function CaretDownIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="-mr-0.5"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function PaneHeader({
  title,
  crumbs,
  onCreateDiagram,
  onCreateFolder,
  folderLabel,
  onOpenNav,
  helpArticle,
  helpTitle,
  helpDescription,
  headerActions,
}: {
  title: string;
  crumbs: { name: string; onClick?: () => void }[];
  // Section-scoped "?" help button, rendered to the left of Create (or
  // alone when the section has no Create action). Deep-links the matching
  // help-centre article (spec/56) for this Explorer section.
  helpArticle?: HelpArticleKey;
  helpTitle?: string;
  helpDescription?: string;
  // Mobile only: opens the section drawer (the sidebar is hidden below
  // `sm`). Renders a hamburger to the left of the title. Omitted on
  // desktop where the sidebar is always visible.
  onOpenNav?: () => void;
  // Optional CTAs rendered in the title row's right edge. Replaces
  // the standalone floating "+" FAB so the actions sit in their
  // current context rather than as a global affordance. New diagram
  // renders first, then New folder / New subfolder (the label
  // varies by selection, so the caller passes it). Both are
  // optional: the Shared / Gallery views pass neither because the
  // verbs don't apply.
  onCreateDiagram?: () => void;
  onCreateFolder?: () => void;
  // "New folder" at the root level, "New subfolder" inside an
  // existing folder. Caller resolves the wording.
  folderLabel?: string;
  // Extra section-specific action(s) rendered in the actions row, just to the
  // right of the help "?" button (e.g. the API tokens "New token" popover
  // button, spec/61). Lets a section add a header CTA without going through
  // the diagram/folder Create dropdown.
  headerActions?: ReactNode;
}) {
  // A single-item breadcrumb is just the page title in a second
  // place: visually noisy and provides no navigation. Show only
  // when there are actual parents to click back to.
  const showCrumbs = crumbs.length >= 2;
  const hasCreate = Boolean(onCreateDiagram || onCreateFolder);
  const hasActions = hasCreate || Boolean(helpArticle) || Boolean(headerActions);
  // A single "+ Create" dropdown (both desktop and mobile) replaces the
  // standalone New-diagram / New-folder buttons: two shrink-0 buttons
  // squeezed the folder-name title to nothing on a narrow phone, and
  // one compact button keeps the title roomy on every screen.
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenNav ? (
            <button
              type="button"
              onClick={onOpenNav}
              aria-label="Browse sections"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:hidden"
            >
              <HamburgerIcon />
            </button>
          ) : null}
          {title ? (
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
          ) : null}
        </div>
        {hasActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {helpArticle ? (
              <HelpArticleLink
                article={helpArticle}
                variant="button"
                title={helpTitle ?? 'Help'}
                description={helpDescription}
              />
            ) : null}
            {headerActions}
            {hasCreate ? (
              <button
                ref={createRef}
                type="button"
                onClick={() => setCreateOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
              >
                <PlusIcon />
                Create
                <CaretDownIcon />
              </button>
            ) : null}
            {createOpen ? (
              <PortalMenu
                anchor={createRef.current}
                placement="below"
                onClose={() => setCreateOpen(false)}
              >
                {onCreateDiagram ? (
                  <MenuItem
                    icon={<DiagramIcon />}
                    label="New diagram"
                    onClick={() => {
                      onCreateDiagram();
                      setCreateOpen(false);
                    }}
                  />
                ) : null}
                {onCreateFolder ? (
                  <MenuItem
                    icon={<MenuFolderIcon />}
                    label={folderLabel ?? 'New folder'}
                    onClick={() => {
                      onCreateFolder();
                      setCreateOpen(false);
                    }}
                  />
                ) : null}
              </PortalMenu>
            ) : null}
          </div>
        ) : null}
      </div>
      {showCrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 shadow-sm"
        >
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.name}-${i}`} className="flex items-center">
                {i > 0 ? (
                  <span aria-hidden className="px-1 text-slate-300">
                    ›
                  </span>
                ) : null}
                {c.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded px-1.5 py-0.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {c.name}
                  </button>
                ) : (
                  <span className="rounded px-1.5 py-0.5 font-medium text-slate-900">{c.name}</span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
