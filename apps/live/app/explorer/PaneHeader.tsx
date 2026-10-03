'use client';

// The Explorer pane header (docs/specs/013-workspace/folders.md): title + breadcrumb on the left, and on
// the right a section "?" help button, any section-specific actions slot, and
// a single Create dropdown (New document / New folder). Split out of views.tsx
// so that barrel holds the list/row primitives while the header chrome (and
// its private hamburger / caret icons) stands on its own.
import { DocumentIcon, FolderOutlineIcon, PlusIcon } from '@/components/primitives/explorer-icons';
import { Button, Glyph } from '@livediagram/ui';
import { useState, type ReactNode } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { HelpArticleKey } from '@/lib/help-articles';
import { MenuTile, PortalMenu } from '@/components/primitives/PortalMenu';
import { paneCreateMode } from './pane-create-action';
import { ViewToggle } from './ViewToggle';
import type { ExplorerViewMode } from './useExplorerViewMode';

function HamburgerIcon() {
  return (
    <Glyph size={18} units={18} strokeLinejoin="miter">
      <path d="M3 5h12M3 9h12M3 13h12" />
    </Glyph>
  );
}

function CaretDownIcon() {
  return (
    <Glyph size={10} units={16} className="-mr-0.5">
      <path d="M4 6l4 4 4-4" />
    </Glyph>
  );
}

export function PaneHeader({
  title,
  crumbs,
  onCreateDocument,
  onCreateFolder,
  folderLabel,
  onOpenNav,
  helpArticle,
  headerActions,
  viewMode,
  onSetViewMode,
}: {
  title: string;
  crumbs: { name: string; onClick?: () => void }[];
  // Section-scoped Help button, rendered to the left of Create (or alone
  // when the section has no Create action). Deep-links the matching
  // help-centre article (docs/specs/018-help/contextual-help-links.md) for this Explorer section; its hover card
  // copy comes from HELP_LINK_COPY.
  helpArticle?: HelpArticleKey;
  // Mobile only: opens the section drawer (the sidebar is hidden below
  // `sm`). Renders a hamburger to the left of the title. Omitted on
  // desktop where the sidebar is always visible.
  onOpenNav?: () => void;
  // Optional CTAs rendered in the title row's right edge. Replaces
  // the standalone floating "+" FAB so the actions sit in their
  // current context rather than as a global affordance. New document
  // renders first, then New folder / New subfolder (the label
  // varies by selection, so the caller passes it). Both are
  // optional: the Shared / Gallery views pass neither because the
  // verbs don't apply.
  onCreateDocument?: () => void;
  onCreateFolder?: () => void;
  // "New folder" at the root level, "New subfolder" inside an
  // existing folder. Caller resolves the wording.
  folderLabel?: string;
  // Extra section-specific action(s) rendered in the actions row, just to the
  // right of the help "?" button (e.g. the API tokens "New token" popover
  // button, docs/specs/015-api/public-api-and-tokens.md). Lets a section add a header CTA without going through
  // the document/folder Create dropdown.
  headerActions?: ReactNode;
  // List/Card toggle (docs/specs/006-document/document-snapshots.md), shown at the far right of the actions row
  // on the browse views that can render either layout. Both must be
  // present for the toggle to appear; sections that only list one way
  // (gallery, tokens, …) omit them.
  viewMode?: ExplorerViewMode;
  onSetViewMode?: (mode: ExplorerViewMode) => void;
}) {
  // A single-item breadcrumb is just the page title in a second
  // place: visually noisy and provides no navigation. Show only
  // when there are actual parents to click back to.
  const showCrumbs = crumbs.length >= 2;
  const showViewToggle = Boolean(viewMode && onSetViewMode);
  // A single "+ Create" dropdown (both desktop and mobile) replaces the
  // standalone New-document / New-folder buttons where BOTH apply: two
  // shrink-0 buttons squeezed the folder-name title to nothing on a narrow
  // phone, and one compact button keeps the title roomy on every screen.
  // Where only one applies it renders as itself — see pane-create-action.ts.
  const createMode = paneCreateMode({
    hasCreateDocument: Boolean(onCreateDocument),
    hasCreateFolder: Boolean(onCreateFolder),
  });
  const hasCreate = createMode.kind !== 'none';
  const hasActions = hasCreate || Boolean(helpArticle) || Boolean(headerActions) || showViewToggle;
  const singleCreate =
    createMode.kind === 'single'
      ? createMode.action === 'document'
        ? { label: 'New document', onClick: onCreateDocument! }
        : { label: folderLabel ?? 'New Folder', onClick: onCreateFolder! }
      : null;
  const [createOpen, setCreateOpen] = useState(false);
  // In state, so the menu anchors to the button on the render that opens it.
  const [createButton, setCreateButton] = useState<HTMLButtonElement | null>(null);
  return (
    <div className="mb-4">
      {/* Wraps on a phone: the actions take a second line rather than squeezing the title to
          nothing. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          {onOpenNav ? (
            <button
              type="button"
              onClick={onOpenNav}
              aria-label="Browse sections"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:hidden"
            >
              <HamburgerIcon />
            </button>
          ) : null}
          {title ? (
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
          ) : null}
        </div>
        {hasActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {/* Section actions first, then Help. Help is the least-used
                control in the row and belongs at its quiet end; leading
                with it pushed the controls a reader actually reaches for
                out to the right. */}
            {headerActions}
            {helpArticle ? <HelpArticleLink article={helpArticle} variant="button" /> : null}
            {singleCreate ? (
              <Button
                size="xs"
                onClick={singleCreate.onClick}
                aria-label={singleCreate.label}
                className="shadow-sm"
              >
                <PlusIcon />
                {/* Label collapses to the icon below `sm:`, the same way the
                    timeline's own mode buttons do — it would otherwise wrap
                    the header row on a phone. aria-label carries the name. */}
                <span className="hidden sm:inline">{singleCreate.label}</span>
              </Button>
            ) : null}
            {createMode.kind === 'menu' ? (
              <Button
                ref={setCreateButton}
                size="xs"
                onClick={() => setCreateOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className="shadow-sm"
              >
                <PlusIcon />
                Create
                <CaretDownIcon />
              </Button>
            ) : null}
            {showViewToggle ? <ViewToggle mode={viewMode!} onChange={onSetViewMode!} /> : null}
            {createOpen ? (
              <PortalMenu
                anchor={createButton}
                placement="below"
                onClose={() => setCreateOpen(false)}
              >
                {/* Icon-over-label tiles (bigger tap targets than thin rows),
                    laid out 2-up when both actions apply, full-width when one. */}
                <div
                  className={`grid gap-1 px-1.5 py-1.5 ${
                    onCreateDocument && onCreateFolder ? 'grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {onCreateDocument ? (
                    <MenuTile
                      icon={
                        <span className="[&_svg]:h-5 [&_svg]:w-5">
                          <DocumentIcon />
                        </span>
                      }
                      label="New document"
                      onClick={() => {
                        onCreateDocument();
                        setCreateOpen(false);
                      }}
                    />
                  ) : null}
                  {onCreateFolder ? (
                    <MenuTile
                      icon={
                        <span className="[&_svg]:h-5 [&_svg]:w-5">
                          <FolderOutlineIcon />
                        </span>
                      }
                      label={folderLabel ?? 'New Folder'}
                      onClick={() => {
                        onCreateFolder();
                        setCreateOpen(false);
                      }}
                    />
                  ) : null}
                </div>
              </PortalMenu>
            ) : null}
          </div>
        ) : null}
      </div>
      {showCrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.name}-${i}`} className="flex items-center">
                {i > 0 ? (
                  <span aria-hidden className="px-1 text-slate-300 dark:text-slate-600">
                    ›
                  </span>
                ) : null}
                {c.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded px-1.5 py-0.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    {c.name}
                  </button>
                ) : (
                  <span className="rounded px-1.5 py-0.5 font-medium text-slate-900 dark:text-slate-100">
                    {c.name}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
