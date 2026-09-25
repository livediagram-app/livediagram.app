'use client';

import { useState, type ReactNode } from 'react';
import { MenuActionRow, MenuGroupSeparator, PortalMenu } from '@/components/primitives/PortalMenu';
import { OpenIcon, PlusIcon } from '@/components/panels/explorer-icons';
import { GearIcon, GithubIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { GITHUB_REPO_URL } from '@/lib/github';
import type { ExplorerMenuActions } from './Explorer.types';

// The Explorer panel header's ⋯ menu (spec/15): the diagram-level verbs that
// used to be split between a "+ New" chip here and the editor's bottom bar.
// Three bands, new/open, then this diagram (share / export), then the app
// (search / GitHub / settings). Each row renders only when its handler is
// wired, and a band left empty takes its separator with it, so the Explorer
// behind an error screen (no diagram, so no share / export) still reads
// cleanly. Rows, not tiles: a ⋯ menu that IS the list (spec/15).
export function ExplorerHeaderMenu({
  onNewDiagram,
  actions = {},
}: {
  onNewDiagram?: () => void;
  actions?: ExplorerMenuActions;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const bands: { key: string; rows: ReactNode[] }[] = [
    {
      key: 'diagrams',
      rows: [
        onNewDiagram ? (
          <MenuActionRow
            key="new"
            plain
            icon={<PlusIcon />}
            label="New Diagram"
            onClick={run(onNewDiagram)}
          />
        ) : null,
        <MenuActionRow
          key="open"
          plain
          icon={<OpenIcon />}
          label="Open Explorer"
          onClick={run(() => {
            window.location.href = '/explorer';
          })}
        />,
      ],
    },
    {
      key: 'diagram',
      rows: [
        actions.onShare ? (
          <MenuActionRow
            key="share"
            plain
            icon={<ShareGlyph />}
            label="Share"
            onClick={run(actions.onShare)}
          />
        ) : null,
        actions.onExport ? (
          <MenuActionRow
            key="export"
            plain
            icon={<ExportGlyph />}
            label="Export"
            onClick={run(actions.onExport)}
          />
        ) : null,
      ],
    },
    {
      key: 'app',
      rows: [
        actions.onSearch ? (
          <MenuActionRow
            key="search"
            plain
            icon={<SearchGlyph />}
            label="Search"
            onClick={run(actions.onSearch)}
          />
        ) : null,
        <MenuActionRow
          key="github"
          plain
          icon={<GithubIcon />}
          label="GitHub"
          onClick={run(() => {
            window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
          })}
        />,
        actions.onOpenSettings ? (
          <MenuActionRow
            key="settings"
            plain
            icon={<GearIcon />}
            label="Settings"
            onClick={run(actions.onOpenSettings)}
          />
        ) : null,
      ],
    },
  ]
    .map((b) => ({ ...b, rows: b.rows.filter(Boolean) }))
    .filter((b) => b.rows.length > 0);

  return (
    <>
      <button
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="3" cy="7" r="1.25" fill="currentColor" />
          <circle cx="7" cy="7" r="1.25" fill="currentColor" />
          <circle cx="11" cy="7" r="1.25" fill="currentColor" />
        </svg>
      </button>
      {anchor ? (
        <PortalMenu anchor={anchor} onClose={close}>
          <div className="min-w-44 py-1">
            {bands.map((band, i) => (
              <div key={band.key}>
                {i > 0 ? <MenuGroupSeparator /> : null}
                {band.rows}
              </div>
            ))}
          </div>
        </PortalMenu>
      ) : null}
    </>
  );
}

// Three linked nodes, the usual share mark.
function ShareGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="3.5" r="1.75" />
      <circle cx="4" cy="8" r="1.75" />
      <circle cx="12" cy="12.5" r="1.75" />
      <path d="M5.5 7.1 10.5 4.4M5.5 8.9l5 2.7" />
    </svg>
  );
}

// A tray with an arrow leaving it: the tab going out as a file.
function ExportGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 10V2.5M5 5.5 8 2.5l3 3" />
      <path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />
    </svg>
  );
}
