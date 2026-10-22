'use client';

// The section the editor's Explorer shows (docs/specs/013-workspace/explorer-structure.md "The rail"): remembered for
// this viewer in this browser, a convenience only, so storage that throws or is empty falls back to Home. A phone's
// sheet opens on Home every time instead ("On a phone").
import { useCallback, useState } from 'react';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import {
  resolveSection,
  sectionFromKey,
  sectionKey,
  sectionTelemetryRow,
  type PanelSection,
  type PanelSectionGroup,
} from './panel-sections';

export const PANEL_SECTION_STORAGE_KEY = 'livepages:explorer-panel-section:v1';

function readRemembered(): PanelSection | null {
  try {
    return sectionFromKey(window.localStorage.getItem(PANEL_SECTION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function remember(section: PanelSection): void {
  try {
    window.localStorage.setItem(PANEL_SECTION_STORAGE_KEY, sectionKey(section));
  } catch {
    // Private window or blocked storage: the panel still works, it just opens on the default next time.
  }
}

export function useExplorerPanelSection(
  groups: PanelSectionGroup[],
  // `homeOnOpen`: each time `open` turns true the panel starts on Home, and a pick is not remembered.
  { homeOnOpen = false, open = false }: { homeOnOpen?: boolean; open?: boolean } = {},
): [PanelSection, (next: PanelSection) => void] {
  const [picked, setPicked] = useState<PanelSection | null>(() =>
    homeOnOpen ? null : readRemembered(),
  );
  // Reset while rendering the opening frame, so the last pick never flashes before Home.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && homeOnOpen) setPicked(null);
  }
  const section = resolveSection({ remembered: picked, groups });
  const pick = useCallback(
    (next: PanelSection) => {
      trackSidebar(sectionTelemetryRow(next), 'panel');
      if (!homeOnOpen) remember(next);
      setPicked(next);
    },
    [homeOnOpen],
  );
  return [section, pick];
}
