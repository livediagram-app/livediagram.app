import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import { ToastBell } from '@liveworkspace/ui/toast';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { TourOfferButton } from '@liveworkspace/workbench/components/tour/TourOfferButton';
import { SettingsIcon, GithubIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { REPO_URL, HoverCard } from '@liveknowledge/ui';
import { useVersionHistoryInTools } from '@/components/versions/history-tools-item';
import {
  ChromeToolsMenu,
  type ChromeToolsItem,
} from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useAutomationsToolsItem } from '@liveworkspace/automations-ui/automations-tools-item';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (docs/specs/007-editor/editor-app.md): search, History (the editor's, on a stored
// document), the open-source GitHub link, settings, and the dark-mode toggle. Each callback-driven control
// renders only when its handler is supplied; dark-mode is always shown, and
// GitHub unless the host opts out. Keyboard shortcuts live in Settings' Keyboard category. Rendered as a fragment
// so each host drops it straight into its own bar flex row.
export function ChromeControls({
  onOpenSearch,
  onOpenHistory,
  onOpenSettings,
  settingsLabel = 'Settings',
  labelled = false,
  github = true,
  appearance = true,
  parts = 'all',
}: {
  // A phone's footer keeps the notification list in its row and puts the rest behind More
  // (docs/specs/030-knowledgebase/page-surface.md "The footer"): 'bell' draws the list alone, 'rest' all but it.
  parts?: 'all' | 'bell' | 'rest';
  onOpenSearch?: () => void;
  // Version History (docs/specs/006-document/version-history.md "In the editor"): the editor passes it on a
  // document stored on the server; the Explorer's bar never does.
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-document; the Explorer's read the same
  // synced preferences. Let the host phrase the hover card.
  settingsLabel?: string;
  settingsDescription?: string;
  labelled?: boolean;
  // The editor moved its GitHub link into the Explorer panel's ⋯ menu
  // (docs/specs/013-workspace/folders.md); the full-page Explorer's bar keeps it.
  github?: boolean;
  // The Appearance control; withheld where the host sets the scheme itself (a workbench frame,
  // docs/specs/013-workspace/blueprints/workbench-embeds.md, WB15).
  appearance?: boolean;
}) {
  const BTN = labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN;
  // Version History lives inside History (owner, 2026-11-17), which the editor's ItemToolsHost publishes.
  useVersionHistoryInTools(onOpenHistory);
  // Search, first in Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md).
  const search: ChromeToolsItem | null = onOpenSearch
    ? {
        id: 'search',
        group: 'find',
        // The ellipsis: it opens outside Tools (footer-tools-menu.md "Opening a tool inside Tools").
        label: 'Search…',
        description: 'Find knowledgebases, pages and elements.',
        icon: <SearchGlyph />,
        onSelect: () => onOpenSearch(),
      }
    : null;
  // Automations, in the Automate group (docs/specs/013-workspace/automations.md "Where it is"): there inside the
  // editor's Automations host for whoever may use it, or must sign in or sync first; nowhere else.
  const automations = useAutomationsToolsItem();
  if (parts === 'bell') return <ToastBell className={CHROME_BTN} />;
  return (
    <>
      {/* The Get Started button, first in the cluster and left of Tools: the one way into a tour,
          drawn only while one is on offer (docs/specs/007-editor/pages-tour.md "Where it appears"). Leading the cluster, it comes and
          goes without moving the controls beside it. */}
      <TourOfferButton labelled={labelled} />
      {/* Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md): the tools that work on the
          whole item, in one menu, drawn only while it holds one. */}
      <ChromeToolsMenu labelled={labelled} items={[search, automations]} />
      {github ? (
        <>
          {/* Open-source repo link (the codebase is public + MIT, docs/specs/002-project-scope/open-source-and-business-model.md). An
          external <a>, not a callback, so it needs no wiring.

          Hidden below sm: the bottom bar is tight on a phone and this is the
          one control here that leaves the app entirely — the others (search,
          settings, dark mode) are things you reach for mid-edit.
          Still reachable from the marketing site and the help centre. */}
          {/* A wrapper, not the HoverCard's className: the HoverCard's own
          inline-flex outranks a `hidden` passed alongside it. */}
          <span className="hidden sm:contents">
            <HoverCard
              title="Source on GitHub"
              description="View liveknowledge's open-source code on GitHub."
            >
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Source on GitHub"
                className={BTN}
              >
                <GithubIcon />
                <ChromeLabel show={labelled}>GitHub</ChromeLabel>
              </a>
            </HoverCard>
          </span>
        </>
      ) : null}
      {onOpenSettings ? (
        <button type="button" onClick={onOpenSettings} aria-label={settingsLabel} className={BTN}>
          <SettingsIcon />
          <ChromeLabel show={labelled}>Settings</ChromeLabel>
        </button>
      ) : null}
      {/* The notification list (liveworkspace/docs/specs/016-notifications/toasts.md): an icon alone, right of
          Settings; toasts collapse into it as they leave. */}
      {/* The bell and the light / dark switch sit as a pair, 4px apart rather than the bar's 12px (the owner,
          2026-11-20). */}
      <span className="inline-flex shrink-0 items-center">
        {parts === 'all' ? <ToastBell className={CHROME_BTN} /> : null}
        {appearance ? <AppearanceToggle /> : null}
      </span>
    </>
  );
}
