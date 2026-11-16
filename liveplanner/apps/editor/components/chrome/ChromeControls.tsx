import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { TourOfferButton } from '@liveworkspace/workbench/components/tour/TourOfferButton';
import { SettingsIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { useSnapshotsToolsItem } from '@liveworkspace/snapshots/ui';
import {
  ChromeToolsMenu,
  type ChromeToolsItem,
} from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useAutomationsToolsItem } from '@/components/automations/automations-tools-item';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (docs/specs/007-editor/editor-app.md): search, settings, and the
// dark-mode toggle. Each callback-driven control renders only when its handler is supplied; dark-mode is
// shown unless the host withholds it. Keyboard shortcuts live in Settings' Keyboard category. Rendered as a fragment
// so each host drops it straight into its own bar flex row.
export function ChromeControls({
  onOpenSearch,
  onOpenSettings,
  settingsLabel = 'Settings',
  labelled = false,
  appearance = true,
}: {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-project; the Explorer's read the same
  // synced preferences. Let the host phrase the hover card.
  settingsLabel?: string;
  settingsDescription?: string;
  labelled?: boolean;
  // The Appearance control; withheld where the host sets the scheme itself (a workbench frame,
  // docs/specs/013-workspace/blueprints/workbench-embeds.md, WB15).
  appearance?: boolean;
}) {
  const BTN = labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN;
  const automations = useAutomationsToolsItem();
  const snapshots = useSnapshotsToolsItem();
  // Search, first in Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md).
  const search: ChromeToolsItem | null = onOpenSearch
    ? { id: 'search', group: 'find', label: 'Search', description: 'Find plans, tabs and elements.', icon: <SearchGlyph />, onSelect: () => onOpenSearch() }
    : null;
  return (
    <>
      {/* The Get Started button, first in the cluster and left of Tools: the one way into a tour,
          drawn only while one is on offer (docs/specs/007-editor/editor-tour.md "Where it appears"). Leading the cluster, it comes and
          goes without moving the controls beside it. */}
      <TourOfferButton labelled={labelled} />
      {/* Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md): the tools that work on the
          whole item, in one menu, drawn only while it holds one. */}
      <ChromeToolsMenu labelled={labelled} items={[search, automations, snapshots]} />
      {onOpenSettings ? (
        <button type="button" onClick={onOpenSettings} aria-label={settingsLabel} className={BTN}>
          <SettingsIcon />
          <ChromeLabel show={labelled}>Settings</ChromeLabel>
        </button>
      ) : null}
      {appearance ? <AppearanceToggle /> : null}
    </>
  );
}
