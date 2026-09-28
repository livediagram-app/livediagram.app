'use client';

import { OpenIcon, PlusIcon } from '@/components/primitives/explorer-icons';
import { useState, type ReactNode } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { MenuActionRow, MenuGroupSeparator, PortalMenu } from '@/components/primitives/PortalMenu';
import {
  SettingsIcon,
  GithubIcon,
  ScaleIcon,
  SearchGlyph,
} from '@/components/chrome/tab-bar-icons';
import { REPO_URL, Glyph } from '@livediagram/ui';
import type { ExplorerMenuActions } from './Explorer.types';
import type { HelpArticleKey } from '@/lib/help-articles';
import { HelpMarkIcon, openHelpArticle } from '@/components/primitives/HelpArticleLink';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';

// The Explorer panel header's ⋯ menu (docs/specs/013-workspace/folders.md): the diagram-level verbs that
// used to be split between a "+ New" chip here and the editor's bottom bar.
// Three bands, new/open, then this diagram (share / export), then the app
// (search / GitHub / Licences / settings). Each row renders only when its handler is
// wired, and a band left empty takes its separator with it, so the Explorer
// behind an error screen (no diagram, so no share / export) still reads
// cleanly. Rows, not tiles: a ⋯ menu that IS the list (docs/specs/013-workspace/folders.md).
export function ExplorerHeaderMenu({
  onNewDiagram,
  actions = {},
  helpArticle,
}: {
  onNewDiagram?: () => void;
  actions?: ExplorerMenuActions;
  // The panel's article. Minimal chrome hides the header's `?`, so Help moves
  // here (docs/specs/007-editor/power-user-mode.md).
  helpArticle?: HelpArticleKey;
}) {
  const minimalChrome = useMinimalChrome();
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
            window.location.assign('/explorer');
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
        helpArticle && minimalChrome ? (
          <MenuActionRow
            key="help"
            plain
            icon={<HelpMarkIcon />}
            label="Help"
            onClick={run(() => openHelpArticle(helpArticle))}
          />
        ) : null,
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
            window.open(REPO_URL, '_blank', 'noopener,noreferrer');
          })}
        />,
        // Third-party licences (docs/specs/002-project-scope/third-party-licences.md),
        // in a new tab like GitHub so the open diagram stays put.
        <MenuActionRow
          key="licences"
          plain
          icon={<ScaleIcon />}
          label="Licences"
          onClick={run(() => {
            window.open('/licences', '_blank', 'noopener,noreferrer');
          })}
        />,
        actions.onOpenSettings ? (
          <MenuActionRow
            key="settings"
            plain
            icon={<SettingsIcon />}
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
      <EllipsisTriggerButton
        size="sm"
        label="More"
        expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      />
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
    <Glyph size={14} units={16}>
      <circle cx="12" cy="3.5" r="1.75" />
      <circle cx="4" cy="8" r="1.75" />
      <circle cx="12" cy="12.5" r="1.75" />
      <path d="M5.5 7.1 10.5 4.4M5.5 8.9l5 2.7" />
    </Glyph>
  );
}

// A tray with an arrow leaving it: the tab going out as a file.
function ExportGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M8 10V2.5M5 5.5 8 2.5l3 3" />
      <path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />
    </Glyph>
  );
}
