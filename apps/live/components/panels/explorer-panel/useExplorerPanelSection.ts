'use client';

// The section the editor's Explorer shows (docs/specs/013-workspace/explorer-structure.md "The rail"): remembered for
// this viewer in this browser, a convenience only, so storage that throws or is empty falls back to Home.
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

export const PANEL_SECTION_STORAGE_KEY = 'livediagram:explorer-panel-section:v1';

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
): [PanelSection, (next: PanelSection) => void] {
  const [picked, setPicked] = useState<PanelSection | null>(readRemembered);
  const section = resolveSection({ remembered: picked, groups });
  const pick = useCallback((next: PanelSection) => {
    trackSidebar(sectionTelemetryRow(next), 'panel');
    remember(next);
    setPicked(next);
  }, []);
  return [section, pick];
}
